/**
 * journeys/scheduler.js
 * Main guest journey scheduler — runs every 15 minutes via cron.
 *
 * Workflow:
 * 1. Load state
 * 2. Fetch active bookings
 * 3. For each booking, compute touchpoints
 * 4. Evaluate each touchpoint against eligibility rules
 * 5. Send due messages and update state
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'state.json');

// Load utilities
const timing = require('../lib/timing');
const optOut = require('../lib/opt-out');
const dedup = require('../lib/deduplication');
const bookingApi = require('../lib/booking-api');
const weather = require('../lib/weather');

// Load templates
const TEMPLATES = {
  'checkin-morning': require('./templates/checkin-morning'),
  'checkin-afternoon': require('./templates/checkin-afternoon'),
  'checkin-evening': require('./templates/checkin-evening'),
  'checkin-late': require('./templates/checkin-late'),
  'daily-morning': require('./templates/daily-morning'),
  'daily-lunch': require('./templates/daily-lunch'),
  'daily-evening': require('./templates/daily-evening'),
  'checkout-morning': require('./templates/checkout-morning'),
  'post-stay': require('./templates/post-stay'),
};

// Limits
const MAX_MESSAGES_PER_DAY = 4;
const MAX_MESSAGES_PER_STAY = 12;
const RECENT_REPLY_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

// CLI flags
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const FORCE_SEND = process.env.FORCE_SEND === '1';

/**
 * Load state from disk.
 */
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { sent: {}, opt_outs: {}, recent_replies: {}, evening_rotation: {} };
  }
}

/**
 * Save state to disk.
 */
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Count messages sent for a specific booking.
 */
function staySendCount(state, bookingId) {
  return Object.values(state.sent && state.sent[bookingId] || {}).length;
}

/**
 * Count today's sends for all bookings.
 */
function todayGlobalSendCount(state) {
  const today = new Date().toISOString().split('T')[0];
  let count = 0;
  for (const touchpoints of Object.values(state.sent || {})) {
    for (const ts of Object.values(touchpoints)) {
      if (ts && ts.startsWith && ts.startsWith(today)) count++;
    }
  }
  return count;
}

/**
 * For check-in day, determine which checkin template to use based on current IST hour.
 * Returns the most appropriate touchpoint type, or null if not check-in day.
 */
function getActiveCheckinTouchpoint(touchpoints, nowUTC) {
  const today = timing.istDateStr(timing.nowIST());
  const checkinTouchpoints = touchpoints.filter(t =>
    t.type.startsWith('checkin-') && t.date === today
  );
  if (checkinTouchpoints.length === 0) return null;

  // Sort by time
  checkinTouchpoints.sort((a, b) => a.time - b.time);

  // Find the last one whose time has passed
  let active = null;
  for (const tp of checkinTouchpoints) {
    if (nowUTC >= tp.time) {
      active = tp;
    }
  }

  // If we're before the first window, return null (not check-in time yet)
  if (!active && checkinTouchpoints.length > 0) {
    // Check if current time is within first window
    const first = checkinTouchpoints[0];
    if (Math.abs(nowUTC - first.time) <= 2) {
      return first;
    }
  }

  return active || checkinTouchpoints[0];
}

/**
 * Main scheduler run.
 */
async function run() {
  const logPrefix = `[scheduler ${new Date().toISOString()}]`;
  console.log(`${logPrefix} Starting run${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  const state = loadState();
  const now = timing.nowIST();
  const todayIST = timing.istDateStr(now);
  const currentUTCHour = now.getUTCHours();

  // Fetch bookings
  let bookings;
  try {
    bookings = await bookingApi.fetchBookings();
  } catch (err) {
    console.error(`${logPrefix} Failed to fetch bookings:`, err.message);
    process.exit(1);
  }

  console.log(`${logPrefix} Found ${bookings.length} confirmed booking(s)`);

  // Fetch weather once (shared across all guests)
  let weatherData;
  try {
    weatherData = await weather.getWeather();
  } catch (err) {
    console.warn(`${logPrefix} Weather fetch failed, using default:`, err.message);
    weatherData = weather.defaultWeather();
  }

  let sentCount = 0;
  let skippedCount = 0;
  const reasons = {};

  function logSkipped(reason) {
    reasons[reason] = (reasons[reason] || 0) + 1;
    skippedCount++;
  }

  for (const booking of bookings) {
    const { id, phone, guest_name, check_in, check_out } = booking;

    // Skip cancelled / completed (already filtered in fetchBookings, but double-check)
    if (booking.status !== 'CONFIRMED') {
      logSkipped('status-not-confirmed');
      continue;
    }

    // Opt-out check
    if (optOut.isOptedOut(phone, id)) {
      logSkipped('opted-out');
      continue;
    }

    // Check-in/out validation
    if (!check_in || !check_out) {
      logSkipped('missing-dates');
      continue;
    }

    // Compute all possible touchpoints
    const allTouchpoints = timing.computeTouchpoints(booking);

    // Recent reply check (skip all for this guest if they replied recently)
    if (!FORCE_SEND && dedup.hasRecentReply(phone, RECENT_REPLY_WINDOW_MS)) {
      logSkipped('recent-reply');
      continue;
    }

    // Stay-level limit
    if (!FORCE && !FORCE_SEND && staySendCount(state, id) >= MAX_MESSAGES_PER_STAY) {
      logSkipped('stay-limit');
      continue;
    }

    // Daily global limit
    if (!FORCE && !FORCE_SEND && todayGlobalSendCount(state) >= MAX_MESSAGES_PER_DAY) {
      logSkipped('daily-limit');
      continue;
    }

    // --- Determine which touchpoints to evaluate ---
    const isCheckinDay = timing.sameDate(check_in, todayIST);
    const isCheckoutDay = timing.sameDate(check_out, todayIST);
    const isPostStayDay = timing.sameDate(timing.addDays(check_out, 1), todayIST);
    const isDuringStay = check_in <= todayIST && todayIST <= check_out;

    // Find relevant touchpoints for today
    let todaysTouchpoints = allTouchpoints.filter(tp => tp.date === todayIST);

    // For check-in day, only evaluate ONE checkin template (the one matching the time window)
    if (isCheckinDay) {
      const activeCheckin = getActiveCheckinTouchpoint(allTouchpoints, currentUTCHour);
      if (activeCheckin) {
        todaysTouchpoints = todaysTouchpoints.filter(
          tp => tp.type === activeCheckin.type || !tp.type.startsWith('checkin-')
        );
      }
    }

    for (const tp of todaysTouchpoints) {
      // Already sent?
      if (!FORCE && !FORCE_SEND && dedup.wasSent(id, tp.type)) {
        logSkipped('already-sent');
        continue;
      }

      // Is it within the time window?
      if (!FORCE_SEND && !timing.isInWindow(currentUTCHour, tp.type, tp.time)) {
        logSkipped('outside-window');
        continue;
      }

      // Quiet hours — skip non-critical messages (queue for morning)
      if (!FORCE_SEND && timing.isQuietHours() && !tp.type.startsWith('checkin-')) {
        logSkipped('quiet-hours');
        continue;
      }

      // Post-stay: only send on post-stay day
      if (tp.type === 'post-stay' && !isPostStayDay) {
        logSkipped('not-post-stay-day');
        continue;
      }

      // Checkout morning: only on checkout day
      if (tp.type === 'checkout-morning' && !isCheckoutDay) {
        logSkipped('not-checkout-day');
        continue;
      }

      // Daily templates: only during stay (not on checkout day for morning/lunch/evening)
      if ((tp.type === 'daily-morning' || tp.type === 'daily-lunch' || tp.type === 'daily-evening')
          && !isDuringStay) {
        logSkipped('not-during-stay');
        continue;
      }

      // Build extras for personalization
      const extras = { weather: weatherData };

      if (tp.type === 'daily-evening') {
        const lastEvening = dedup.getLastEveningActivity(id);
        const activity = require('../lib/personalization').selectEveningActivity(booking, lastEvening);
        extras.eveningActivity = activity;
        extras.currentDay = timing.nightCount(check_in, todayIST) + 1;
      }

      if (tp.type === 'checkout-morning') {
        const nights = timing.nightCount(check_in, todayIST);
        extras.currentDay = nights;
      }
      if (tp.type === 'daily-morning' || tp.type === 'daily-lunch') {
        extras.currentDay = timing.nightCount(check_in, todayIST) + 1;
      }

      // Render message
      const template = TEMPLATES[tp.type];
      if (!template) {
        console.warn(`${logPrefix} No template for type: ${tp.type}`);
        logSkipped('no-template');
        continue;
      }

      let body;
      try {
        body = template.render(booking, extras);
      } catch (err) {
        console.error(`${logPrefix} Template render failed for ${id}/${tp.type}:`, err.message);
        logSkipped('render-error');
        continue;
      }

      // Send
      if (DRY_RUN) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`[DRY RUN] Would send to ${guest_name} (${phone})`);
        console.log(`  Type: ${tp.type} | Label: ${tp.label}`);
        console.log(`  Template: ${tp.type}`);
        console.log(`  Message:\n${body}`);
        console.log(`${'='.repeat(60)}\n`);
        sentCount++;
      } else {
        const { sendMessage } = require('./dispatcher');
        const result = await sendMessage(phone, body);
        if (result.success) {
          dedup.markSent(id, tp.type);
          sentCount++;

          // Track evening activity rotation
          if (tp.type === 'daily-evening' && extras.eveningActivity) {
            dedup.setEveningActivity(id, extras.eveningActivity.type);
          }
        }
      }
    }
  }

  console.log(`${logPrefix} Done. Sent: ${sentCount} | Skipped: ${skippedCount}`);
  if (Object.keys(reasons).length > 0) {
    console.log(`${logPrefix} Skip reasons:`, JSON.stringify(reasons));
  }
}

// Export for testing
module.exports = { run };

// Run if executed directly
if (require.main === module) {
  run().catch(err => {
    console.error('[scheduler] Fatal error:', err);
    process.exit(1);
  });
}
