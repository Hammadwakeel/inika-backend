/**
 * Template: checkin-afternoon
 * Sent: Check-in day, 12 PM IST — for guests arriving midday/afternoon.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Good afternoon, [Name]! ☀️

Check-in · Day 1 at Inika Resorts

[WeatherCondition] and [WeatherTemp] — ideal conditions to cool off at our infinity pool or enjoy a lazy afternoon on the veranda.

Your [Room] is all set for you. We hope you find it comfortable and cozy.

[WelcomeBack][Acknowledgment][OccasionMention]
[GroupGreeting][RequestsNote]

Any questions? Our concierge team is just a message away — reply here or call [ResortPhone].

Enjoy your afternoon! 🌿

— Inika`;

function render(booking, extras = {}) {
  return applyPersonalization(TEMPLATE, booking, extras).trim();
}

module.exports = { render };
