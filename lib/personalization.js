/**
 * lib/personalization.js
 * Fills message templates with guest-specific data.
 */

const { nightCount } = require('./timing');

/**
 * Evening activity options — rotates based on last selection.
 */
const EVENING_ACTIVITIES = [
  {
    type: 'campfire',
    headline: 'Evening Campfire',
    description: 'Join us at the outdoor cafe for a cozy campfire under the stars tonight. S\'mores, stories, and warm conversations await.',
    icon: '🔥',
  },
  {
    type: 'coriander',
    headline: 'Dinner at The Coriander',
    description: 'Our multi-cuisine restaurant is serving its signature Kodava specialties tonight. We\'d love to reserve a table for you!',
    icon: '🍽️',
  },
  {
    type: 'poolside',
    headline: 'Poolside Evening',
    description: 'The Cabana pool is open until late. Enjoy handcrafted mocktails and gourmet snacks by the water — a perfect way to end the day.',
    icon: '🏊',
  },
  {
    type: 'stargazing',
    headline: 'Stargazing Walk',
    description: 'Tonight\'s clear skies make for perfect stargazing. Our guides can take you on a short walk to the best viewing spot on the property.',
    icon: '🌌',
  },
  {
    type: 'coffee',
    headline: 'Coffee Estate Evening',
    description: 'End your day with a cup of our freshly roasted Coorg coffee at the outdoor cafe. There\'s nothing quite like it.',
    icon: '☕',
  },
];

/**
 * Select the next evening activity, rotating from the last one.
 * @param {object} booking
 * @param {string|null} lastActivity
 * @returns {object}
 */
function selectEveningActivity(booking, lastActivity) {
  const lastIdx = lastActivity
    ? EVENING_ACTIVITIES.findIndex(a => a.type === lastActivity)
    : -1;
  const nextIdx = (lastIdx + 1) % EVENING_ACTIVITIES.length;
  return EVENING_ACTIVITIES[nextIdx];
}

/**
 * Get first name from full name.
 * @param {string} fullName
 * @returns {string}
 */
function firstName(fullName) {
  if (!fullName) return 'Guest';
  const parts = fullName.trim().split(/\s+/);
  return parts[0];
}

/**
 * Replace all template tokens in a string.
 * Supports:
 *   [Field]           — simple variable substitution
 *   [s/Field]         — pluralization: outputs "s" if Field > 1, else ""
 *   [word/Field/alt]   — conditional: outputs "word" if Field > 1, else "alt"
 * @param {string} text
 * @param {object} vars
 * @returns {string}
 */
function replaceTokens(text, vars) {
  // Handle plural patterns first: [s/Field] → "s" if Field > 1
  text = text.replace(/\[s\/(\w+)\]/g, (_, key) => {
    const val = parseInt(vars[key], 10);
    return (!isNaN(val) && val > 1) ? 's' : '';
  });

  // Handle conditional: [word/Field/alt] → "word" if Field > 1, else "alt"
  text = text.replace(/\[(\w+)\/(\w+)\/([^\]]+)\]/g, (_, word, key, alt) => {
    const val = parseInt(vars[key], 10);
    return (!isNaN(val) && val > 1) ? word : alt;
  });

  // Simple variable substitution
  return text.replace(/\[(\w+)\]/g, (_, key) =>
    vars[key] !== undefined ? vars[key] : `[${key}]`
  );
}

/**
 * Build the variable map for a booking.
 * @param {object} booking
 * @param {object} extras — { weather, eveningActivity, currentDay }
 * @returns {object}
 */
function buildVars(booking, extras = {}) {
  const nights = nightCount(booking.check_in, booking.check_out);
  const guestName = firstName(booking.guest_name);

  // Source-specific messaging
  let sourceMention = '';
  if (booking.booking_source === 'booking.com') {
    sourceMention = ' through Booking.com';
  } else if (booking.booking_source === 'airbnb') {
    sourceMention = ' via Airbnb';
  } else if (booking.booking_source === 'makemytrip') {
    sourceMention = ' through MakeMyTrip';
  }

  // Occasion mention
  let occasionMention = '';
  if (booking.special_occasion === 'anniversary') {
    occasionMention = ' Happy upcoming anniversary! We\'d love to make it extra special — just let us know how we can help. ';
  } else if (booking.special_occasion === 'birthday') {
    occasionMention = ' A birthday celebration is in order! Our team would be honored to make it memorable. ';
  } else if (booking.special_occasion === 'honeymoon') {
    occasionMention = ' What an exciting time — congratulations on your honeymoon! We\'re here to make every moment magical. ';
  }

  // Repeat guest
  let welcomeBack = booking.is_repeat
    ? 'Welcome back to Inika! 🌿 It\'s wonderful to have you with us again. '
    : `Welcome to Inika Resorts${sourceMention}! We\'re thrilled to host you. `;

  // Couple vs group
  let groupGreeting = booking.is_couple
    ? `We can\'t wait to share the beauty of Coorg with the both of you. `
    : booking.guest_count > 2
    ? `We can\'t wait to welcome your group of ${booking.guest_count}! `
    : '';

  // Special requests acknowledgment
  let requestsNote = '';
  if (booking.special_requests && booking.special_requests.trim()) {
    requestsNote = `\n\nWe\'ve noted your request: "${booking.special_requests.trim()}" — we\'ll take good care of it.`;
  }

  // Weather note
  let weatherNote = '';
  if (extras.weather) {
    const { condition, temp } = extras.weather;
    if (temp) weatherNote = ` Current temperature: ${temp}°C.`;
    if (condition) {
      const cond = condition.toLowerCase();
      if (cond.includes('rain') || cond.includes('drizzle')) {
        weatherNote += ' Pack a light layer — Coorg is at its most magical green right now!';
      } else if (cond.includes('clear') || cond.includes('sunny')) {
        weatherNote += ' Perfect weather ahead — sunglasses recommended!';
      }
    }
  }

  // Evening activity
  let eveningNote = '';
  if (extras.eveningActivity) {
    const act = extras.eveningActivity;
    eveningNote = `\n\n${act.icon} ${act.headline}\n${act.description}`;
  }

  // Current day of stay
  let dayLabel = '';
  if (extras.currentDay) {
    dayLabel = `Day ${extras.currentDay} of ${nights}`;
  }

  return {
    Name: guestName,
    FullName: booking.guest_name || 'Guest',
    Room: booking.room_name || booking.room_type || 'your cottage',
    RoomType: booking.room_type || '',
    GuestCount: String(booking.guest_count),
    Nights: String(nights),
    CheckIn: booking.check_in,
    CheckOut: booking.check_out,
    Source: booking.booking_source || 'direct',
    Requests: booking.special_requests || '',
    WelcomeBack: welcomeBack,
    GroupGreeting: groupGreeting,
    OccasionMention: occasionMention,
    RequestsNote: requestsNote,
    WeatherNote: weatherNote,
    EveningNote: eveningNote,
    DayLabel: dayLabel,
    Acknowledgment: booking.acknowledgment || '',
    ResortPhone: '+91 90357 40031',
    ResortName: 'Inika Resorts',
    ResortLocation: 'Coorg',
    CheckInTime: '11:00 AM',
    CheckOutTime: '11:00 AM',
  };
}

/**
 * Apply all personalization to a template string.
 * @param {string} template
 * @param {object} booking
 * @param {object} extras
 * @returns {string}
 */
function applyPersonalization(template, booking, extras = {}) {
  const vars = buildVars(booking, extras);
  return replaceTokens(template, vars);
}

module.exports = {
  selectEveningActivity,
  buildVars,
  applyPersonalization,
  firstName,
  EVENING_ACTIVITIES,
};
