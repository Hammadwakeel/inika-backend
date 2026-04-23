/**
 * Template: checkin-late
 * Sent: Check-in day, 10 PM IST — for guests arriving late at night.
 * Tone is calm and minimal — don't overwhelm a tired traveler.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Welcome, [Name]! 🌙

Check-in · Day 1 at Inika Resorts

It's a mild [WeatherTemp] outside — a cool, peaceful night in Coorg.

Your [Room] is prepared and turndown service is complete. Rest well — breakfast starts at 7 AM at The Coriander.

We'll be here if you need anything overnight. Sweet dreams! 🌙

— Inika`;

function render(booking, extras = {}) {
  return applyPersonalization(TEMPLATE, booking, extras).trim();
}

module.exports = { render };
