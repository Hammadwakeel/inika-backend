/**
 * lib/timing.js
 * IST timezone utilities and touchpoint computation.
 * Quiet hours: 10 PM – 8 AM IST.
 */

const IST_OFFSET_HOURS = 5.5;

/**
 * Get the current time in IST.
 * @returns {Date}
 */
function nowIST() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + IST_OFFSET_HOURS * 3600000);
}

/**
 * Format a Date as YYYY-MM-DD in IST.
 * @param {Date} date
 * @returns {string}
 */
function istDateStr(date) {
  const d = new Date(date.getTime() + date.getTimezoneOffset() * 60000 + IST_OFFSET_HOURS * 3600000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Get the time-of-day label in IST.
 * @param {Date} [date] — defaults to now
 * @returns {'morning'|'afternoon'|'evening'|'night'}
 */
function getISTMode(date) {
  const d = date || nowIST();
  const hours = d.getUTCHours() + IST_OFFSET_HOURS;
  const h = hours % 24;
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

/**
 * Returns true if current IST time is within quiet hours (10 PM – 8 AM).
 * @returns {boolean}
 */
function isQuietHours() {
  const hours = (nowIST().getUTCHours() + IST_OFFSET_HOURS) % 24;
  return hours >= 22 || hours < 8;
}

/**
 * Returns true if the given UTC hour (0-23) falls in quiet hours in IST.
 * @param {number} utcHour
 * @returns {boolean}
 */
function isQuietHoursUTC(utcHour) {
  const istHour = (utcHour + IST_OFFSET_HOURS) % 24;
  return istHour >= 22 || istHour < 8;
}

/**
 * Returns true if the message should be queued for the next morning slot.
 * @returns {boolean}
 */
function shouldQueueForMorning() {
  return isQuietHours();
}

/**
 * Parse a YYYY-MM-DD string into a Date at midnight IST.
 * @param {string} dateStr
 * @returns {Date}
 */
function parseISTDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Create at 00:00 IST = given UTC adjusted
  const utcMs = Date.UTC(y, m - 1, d) - IST_OFFSET_HOURS * 3600000;
  return new Date(utcMs);
}

/**
 * Add days to a date string.
 * @param {string} dateStr — YYYY-MM-DD in IST
 * @param {number} days
 * @returns {string} — YYYY-MM-DD
 */
function addDays(dateStr, days) {
  const d = parseISTDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return istDateStr(d);
}

/**
 * Check if two YYYY-MM-DD strings refer to the same IST date.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function sameDate(a, b) {
  return a === b;
}

/**
 * Check if dateStr is before today (IST).
 * @param {string} dateStr
 * @returns {boolean}
 */
function isPast(dateStr) {
  return dateStr < istDateStr(nowIST());
}

/**
 * Check if dateStr is today (IST).
 * @param {string} dateStr
 * @returns {boolean}
 */
function isToday(dateStr) {
  return dateStr === istDateStr(nowIST());
}

/**
 * Check if dateStr is tomorrow (IST).
 * @param {string} dateStr
 * @returns {boolean}
 */
function isTomorrow(dateStr) {
  return dateStr === addDays(istDateStr(nowIST()), 1);
}

/**
 * Number of nights between two YYYY-MM-DD strings.
 * @param {string} checkIn
 * @param {string} checkOut
 * @returns {number}
 */
function nightCount(checkIn, checkOut) {
  const a = parseISTDate(checkIn);
  const b = parseISTDate(checkOut);
  return Math.round((b - a) / 86400000);
}

/**
 * Compute all touchpoints for a booking.
 * Each touchpoint: { type, date, time, label }
 * time is UTC hour (0-23) when this message should fire.
 *
 * @param {object} booking
 * @returns {Array<{type: string, date: string, time: number, label: string}>}
 */
function computeTouchpoints(booking) {
  const { check_in, check_out } = booking;
  const nights = nightCount(check_in, check_out);
  const points = [];

  // Check-in messages on check-in day — pick ONE based on current time
  // These are "available slots"; scheduler picks the right one
  points.push({
    type: 'checkin-morning',
    date: check_in,
    time: 2, // 8 AM IST = 2:30 UTC ≈ 2
    label: 'Check-in morning',
  });
  points.push({
    type: 'checkin-afternoon',
    date: check_in,
    time: 6, // 12 PM IST = 6:30 UTC ≈ 6
    label: 'Check-in afternoon',
  });
  points.push({
    type: 'checkin-evening',
    date: check_in,
    time: 11, // 5 PM IST = 11:30 UTC ≈ 11
    label: 'Check-in evening',
  });
  points.push({
    type: 'checkin-late',
    date: check_in,
    time: 16, // 10 PM IST = 16:30 UTC ≈ 16
    label: 'Check-in late night',
  });

  // Daily morning (Day 2..N), 8:30 AM IST
  for (let day = 2; day <= nights; day++) {
    points.push({
      type: 'daily-morning',
      date: addDays(check_in, day - 1),
      time: 3, // 8:30 AM IST
      label: `Daily morning — day ${day}`,
    });
  }

  // Daily lunch, 12:00 PM IST
  for (let day = 1; day <= nights; day++) {
    points.push({
      type: 'daily-lunch',
      date: addDays(check_in, day - 1),
      time: 6, // 12 PM IST
      label: `Daily lunch — day ${day}`,
    });
  }

  // Daily evening, 5:30 PM IST
  for (let day = 1; day <= nights; day++) {
    points.push({
      type: 'daily-evening',
      date: addDays(check_in, day - 1),
      time: 12, // 5:30 PM IST
      label: `Daily evening — day ${day}`,
    });
  }

  // Checkout morning
  points.push({
    type: 'checkout-morning',
    date: check_out,
    time: 2, // 8 AM IST
    label: 'Checkout morning',
  });

  // Post-stay: day after checkout, 10 AM IST
  points.push({
    type: 'post-stay',
    date: addDays(check_out, 1),
    time: 4, // 10 AM IST
    label: 'Post-stay thank you',
  });

  return points;
}

/**
 * Given the current UTC hour and a touchpoint time (UTC), is this touchpoint
 * within its active window? Returns true if the scheduler should consider it.
 * Windows: morning (2±2h), afternoon (6±2h), evening (11±2h), late (16±2h)
 * For non-checkin touchpoints, fires at exact hour.
 *
 * @param {number} currentUTCHour — current UTC hour (0-23)
 * @param {string} touchpointType
 * @param {number} touchpointTime — target UTC hour
 * @returns {boolean}
 */
function isInWindow(currentUTCHour, touchpointType, touchpointTime) {
  if (touchpointType.startsWith('checkin-')) {
    // Allow a 3-hour window centered on the target
    const window = 2;
    return Math.abs(currentUTCHour - touchpointTime) <= window;
  }
  // For other touchpoints, fire within 1 hour of target
  return Math.abs(currentUTCHour - touchpointTime) <= 1;
}

module.exports = {
  nowIST,
  istDateStr,
  getISTMode,
  isQuietHours,
  isQuietHoursUTC,
  shouldQueueForMorning,
  parseISTDate,
  addDays,
  sameDate,
  isPast,
  isToday,
  isTomorrow,
  nightCount,
  computeTouchpoints,
  isInWindow,
  IST_OFFSET_HOURS,
};
