/**
 * lib/deduplication.js
 * Prevents sending duplicate messages within a sliding window.
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '../journeys/state.json');

/**
 * Load state.
 * @returns {object}
 */
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { sent: {}, opt_outs: {}, recent_replies: {}, evening_rotation: {} };
  }
}

/**
 * Save state.
 * @param {object} state
 */
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Check if the guest has sent an inbound message within the window.
 * If they have, skip the outbound touchpoint.
 *
 * @param {string} phone
 * @param {number} [windowMs] — default 2 hours
 * @returns {boolean}
 */
function hasRecentReply(phone, windowMs = 2 * 60 * 60 * 1000) {
  const state = loadState();
  const lastReply = state.recent_replies && state.recent_replies[phone];
  if (!lastReply) return false;
  const elapsed = Date.now() - new Date(lastReply).getTime();
  return elapsed < windowMs;
}

/**
 * Record that the guest replied.
 * @param {string} phone
 */
function markGuestReplied(phone) {
  const state = loadState();
  if (!state.recent_replies) state.recent_replies = {};
  state.recent_replies[phone] = new Date().toISOString();
  saveState(state);
}

/**
 * Count how many messages were sent today to a phone.
 * @param {string} phone
 * @returns {number}
 */
function todaySendCount(phone) {
  const state = loadState();
  const today = new Date().toISOString().split('T')[0];
  let count = 0;
  for (const [, touchpoints] of Object.entries(state.sent || {})) {
    for (const [, timestamp] of Object.entries(touchpoints)) {
      if (timestamp.startsWith(today)) count++;
    }
  }
  return count;
}

/**
 * Check if a touchpoint was already sent for this booking.
 * @param {string} bookingId
 * @param {string} touchpointType
 * @returns {boolean}
 */
function wasSent(bookingId, touchpointType) {
  const state = loadState();
  return !!(state.sent && state.sent[bookingId] && state.sent[bookingId][touchpointType]);
}

/**
 * Mark a touchpoint as sent.
 * @param {string} bookingId
 * @param {string} touchpointType
 */
function markSent(bookingId, touchpointType) {
  const state = loadState();
  if (!state.sent) state.sent = {};
  if (!state.sent[bookingId]) state.sent[bookingId] = {};
  state.sent[bookingId][touchpointType] = new Date().toISOString();
  saveState(state);
}

/**
 * Get the last evening activity type sent to a booking.
 * @param {string} bookingId
 * @returns {string|null}
 */
function getLastEveningActivity(bookingId) {
  const state = loadState();
  return (state.evening_rotation && state.evening_rotation[bookingId]) || null;
}

/**
 * Record which evening activity type was sent.
 * @param {string} bookingId
 * @param {string} activityType
 */
function setEveningActivity(bookingId, activityType) {
  const state = loadState();
  if (!state.evening_rotation) state.evening_rotation = {};
  state.evening_rotation[bookingId] = activityType;
  saveState(state);
}

module.exports = {
  hasRecentReply,
  markGuestReplied,
  todaySendCount,
  wasSent,
  markSent,
  getLastEveningActivity,
  setEveningActivity,
};
