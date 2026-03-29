/**
 * lib/booking-api.js
 * Fetches and normalizes bookings.
 * Currently uses mock data — replace fetchFromAPI() with real endpoint.
 *
 * Booking schema:
 * {
 *   id: string,
 *   guest_name: string,
 *   phone: string,          // E.164 format
 *   check_in: string,       // YYYY-MM-DD
 *   check_out: string,      // YYYY-MM-DD
 *   room_type: string,
 *   room_name: string,      // e.g. "Jasmine Cottage"
 *   guest_count: number,
 *   is_couple: boolean,
 *   booking_source: string, // e.g. "direct", "booking.com", "airbnb"
 *   special_requests: string,
 *   status: string,         // CONFIRMED | CANCELLED | COMPLETED | PENDING
 *   special_occasion: string | null, // "anniversary", "birthday", "honeymoon"
 *   is_repeat: boolean,
 *   created_at: string      // ISO timestamp — for same-day booking check
 * }
 */

const { istDateStr, nowIST, addDays } = require('./timing');

/**
 * Real API call — replace with actual endpoint.
 * @returns {Promise<object[]>}
 */
async function fetchFromAPI() {
  // TODO: Replace with real booking API call
  // Example:
  // const response = await fetch('https://your-booking-api.com/bookings', {
  //   headers: { Authorization: `Bearer ${process.env.BOOKING_API_KEY}` }
  // });
  // return response.json();
  return [];
}

/**
 * Normalize raw booking objects into the standard schema.
 * @param {object} raw
 * @returns {object}
 */
function normalize(raw) {
  return {
    id: String(raw.id || raw.booking_id || ''),
    guest_name: String(raw.guest_name || raw.guest_name || 'Guest'),
    phone: normalizePhone(raw.phone || raw.phone_number || ''),
    check_in: raw.check_in || raw.checkin || '',
    check_out: raw.check_out || raw.checkout || '',
    room_type: raw.room_type || '',
    room_name: raw.room_name || raw.room || '',
    guest_count: Number(raw.guest_count || raw.guests || 1),
    is_couple: !!(raw.is_couple || raw.is_couple === 'true' || raw.trip_type === 'couple'),
    booking_source: raw.booking_source || raw.source || 'direct',
    special_requests: raw.special_requests || raw.requests || '',
    status: (raw.status || 'CONFIRMED').toUpperCase(),
    special_occasion: raw.special_occasion || null,
    is_repeat: !!(raw.is_repeat || raw.repeat_guest),
    created_at: raw.created_at || new Date().toISOString(),
  };
}

/**
 * Normalize phone to E.164.
 * @param {string} phone
 * @returns {string}
 */
function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits[0] === '0') return `+91${digits.slice(1)}`;
  if (digits.length === 12) return `+${digits}`;
  return phone;
}

/**
 * Main fetch function — returns only active (CONFIRMED) bookings.
 * @returns {Promise<object[]>}
 */
async function fetchBookings() {
  let raw;
  try {
    raw = await fetchFromAPI();
  } catch (err) {
    console.error('[booking-api] API fetch failed, using mock data:', err.message);
    raw = getMockBookings();
  }

  // Fall back to mock data if API returned empty (no API key configured yet)
  if (!raw || raw.length === 0) {
    console.log('[booking-api] No bookings from API — using mock data (set BOOKING_API_KEY to use real data)');
    raw = getMockBookings();
  }

  return raw
    .map(normalize)
    .filter(b => b.status === 'CONFIRMED' && b.id && b.phone && b.check_in && b.check_out);
}

/**
 * Mock bookings for development and testing.
 * @returns {object[]}
 */
function getMockBookings() {
  const today = istDateStr(nowIST());
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);
  const nextWeek = addDays(today, 7);

  return [
    // Currently staying — checkout tomorrow
    {
      id: 'mock-001',
      guest_name: 'Priya Sharma',
      phone: '+919876543210',
      check_in: addDays(today, -2),
      check_out: tomorrow,
      room_type: 'Luxury Cottage',
      room_name: 'Jasmine Cottage',
      guest_count: 2,
      is_couple: true,
      booking_source: 'direct',
      special_requests: 'Extra pillows please',
      status: 'CONFIRMED',
      special_occasion: 'anniversary',
      is_repeat: false,
      created_at: addDays(today, -5),
    },
    // Checking in today
    {
      id: 'mock-002',
      guest_name: 'Arjun Nair',
      phone: '+919988776655',
      check_in: today,
      check_out: dayAfter,
      room_type: 'Premium Cottage',
      room_name: 'Hibiscus Cottage',
      guest_count: 1,
      is_couple: false,
      booking_source: 'booking.com',
      special_requests: '',
      status: 'CONFIRMED',
      special_occasion: null,
      is_repeat: true,
      created_at: addDays(today, -3),
    },
    // Arriving tomorrow
    {
      id: 'mock-003',
      guest_name: 'Rohan & Meera',
      phone: '+919945678901',
      check_in: tomorrow,
      check_out: addDays(tomorrow, 3),
      room_type: 'Luxury Cottage',
      room_name: 'Gulmohar Cottage',
      guest_count: 2,
      is_couple: true,
      booking_source: 'airbnb',
      special_requests: 'Late check-in expected — around 10 PM',
      status: 'CONFIRMED',
      special_occasion: 'honeymoon',
      is_repeat: false,
      created_at: addDays(today, -10),
    },
    // Next week
    {
      id: 'mock-004',
      guest_name: 'Vikram Patel',
      phone: '+919912345678',
      check_in: nextWeek,
      check_out: addDays(nextWeek, 2),
      room_type: 'Row House',
      room_name: 'Room 3',
      guest_count: 3,
      is_couple: false,
      booking_source: 'direct',
      special_requests: 'Birthday celebration for one guest',
      status: 'CONFIRMED',
      special_occasion: 'birthday',
      is_repeat: false,
      created_at: addDays(today, -1),
    },
  ];
}

module.exports = {
  fetchBookings,
  getMockBookings,
  normalize,
  normalizePhone,
};
