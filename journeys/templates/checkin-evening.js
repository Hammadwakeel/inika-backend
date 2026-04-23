/**
 * Template: checkin-evening
 * Sent: Check-in day, 5 PM IST — for guests arriving late afternoon/evening.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Good evening, [Name]! 🌅

Check-in · Day 1 at Inika Resorts

[WeatherCondition] at [WeatherTemp] as the sun sets over Coorg — a beautiful start to your evening.

We invite you to join us for sunset cocktails at our rooftop bar. Tonight's special: fresh local cuisine under the stars at The Coriander.

Your [Room] is all ready for you.

[WelcomeBack][Acknowledgment][OccasionMention]
[GroupGreeting][RequestsNote]

Need anything to make your evening more comfortable? Just reply here — we're always here to help.

Enjoy your first evening! 🌿

— Inika`;

function render(booking, extras = {}) {
  const acknowledgment = booking.booking_source !== 'direct'
    ? `All confirmed from ${booking.booking_source} — you're all set! `
    : '';
  return applyPersonalization(TEMPLATE, { ...booking, acknowledgment }, extras).trim();
}

module.exports = { render };
