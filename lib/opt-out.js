/**
 * lib/opt-out.js
 * Manages guest opt-out preferences per phone number.
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '../journeys/state.json');

/**
 * Load the full state file.
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
 * Save state back to disk.
 * @param {object} state
 */
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Check if a guest has opted out for a specific stay.
 * @param {string} phone — E.164 format
 * @param {string} stayId — booking ID
 * @returns {boolean}
 */
function isOptedOut(phone, stayId) {
  const state = loadState();
  const entry = state.opt_outs && state.opt_outs[phone];
  if (!entry) return false;

  // Check if this stay is specifically opted out
  if (entry.stay_id && entry.stay_id !== stayId) return false;

  // Check if muted indefinitely or until a future date
  if (entry.until) {
    const today = new Date().toISOString().split('T')[0];
    if (entry.until > today) return true;
    // If past expiry, clean it up
    const newState = loadState();
    delete newState.opt_outs[phone];
    saveState(newState);
    return false;
  }

  return true;
}

/**
 * Opt a guest out for a specific stay.
 * @param {string} phone
 * @param {string} stayId
 * @param {'STOP'|'MUTE'} reason
 * @param {string|null} [until] — YYYY-MM-DD, null = indefinite
 */
function optOut(phone, stayId, reason = 'STOP', until = null) {
  const state = loadState();
  if (!state.opt_outs) state.opt_outs = {};
  state.opt_outs[phone] = { stay_id: stayId, reason, until };
  saveState(state);
}

/**
 * Opt a guest back in (remove opt-out entry).
 * @param {string} phone
 */
function optIn(phone) {
  const state = loadState();
  if (state.opt_outs && state.opt_outs[phone]) {
    delete state.opt_outs[phone];
    saveState(state);
  }
}

/**
 * Handle an inbound STOP/MUTE/RESUME keyword.
 * Returns a response string if a special auto-reply should be sent, else null.
 *
 * @param {string} message — raw inbound message text
 * @param {string} phone
 * @param {string} stayId — current active booking ID for this guest
 * @returns {string|null} — auto-reply message or null
 */
function handleKeyword(message, phone, stayId) {
  const text = (message || '').trim().toUpperCase();

  if (text === 'STOP' || text === 'UNSUBSCRIBE') {
    optOut(phone, stayId, 'STOP');
    return 'You will no longer receive messages from Inika Resorts. To re-subscribe, reply RESUME.';
  }

  if (text === 'MUTE') {
    // Mute for 7 days
    const until = new Date();
    until.setDate(until.getDate() + 7);
    const untilStr = until.toISOString().split('T')[0];
    optOut(phone, stayId, 'MUTE', untilStr);
    return 'Messages muted for 7 days. Reply RESUME to receive updates again.';
  }

  if (text === 'RESUME' || text === 'START') {
    optIn(phone);
    return 'Welcome back! You will receive updates from Inika Resorts again. 🌿';
  }

  return null;
}

module.exports = {
  isOptedOut,
  optOut,
  optIn,
  handleKeyword,
};
