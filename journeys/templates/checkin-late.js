/**
 * Template: checkin-late
 * Sent: Check-in day, 10 PM IST — for guests arriving late at night.
 * Tone is calm, minimal — don\'t overwhelm a tired traveler.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Hi [Name]! 🌙

Welcome to [ResortName] in Coorg — you made it!

Your cottage is ready for you:
🏡 [Room]

Rest up tonight. Tomorrow, the real adventure begins. ☕🌿

Breakfast is served from 7:30 AM at The Coriander.

If you need anything overnight, call the front desk at [ResortPhone] — we\'re always here.

Sweet dreams from Coorg! 🌙

— Inika`;

function render(booking, extras = {}) {
  return applyPersonalization(TEMPLATE, booking, extras).trim();
}

module.exports = { render };
