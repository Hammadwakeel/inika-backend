/**
 * Template: checkin-morning
 * Sent: Check-in day, 8 AM IST — for guests arriving morning/early afternoon.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Good morning, [Name]! 🌴

Check-in · Day 1 at Inika Resorts

[WeatherCondition] at [WeatherTemp] — perfect weather to explore our grounds in Coorg.

Your [Room] is ready and waiting for you. We'd love to have you settle in and make yourself at home.

[WelcomeBack][Acknowledgment][OccasionMention]
[GroupGreeting][RequestsNote]

Breakfast is served at The Coriander until 10 AM. Our team is on hand — reply here or call [ResortPhone].

Enjoy your stay! 🌿

— Inika`;

function render(booking, extras = {}) {
  return applyPersonalization(TEMPLATE, booking, extras).trim();
}

module.exports = { render };
