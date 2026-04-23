/**
 * Template: daily-lunch
 * Sent: Each full day of stay, 12 PM IST.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Happy lunch hour, [Name]! 🍽️

[WeatherCondition] at [WeatherTemp] — stay hydrated and beat the heat!

Your dining options today:
📍 The Coriander — multi-cuisine with local Kodava specialties
📍 The Cabana — poolside platters and fresh juices by the water

Reservations welcome — just reply here or call [ResortPhone].

Enjoy your afternoon! ☀️

— Inika`;

function render(booking, extras = {}) {
  return applyPersonalization(TEMPLATE, booking, extras).trim();
}

module.exports = { render };
