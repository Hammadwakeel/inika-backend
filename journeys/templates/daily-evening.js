/**
 * Template: daily-evening
 * Sent: Each full day of stay, 5:30 PM IST.
 * Includes a rotating evening activity recommendation.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Good evening, [Name]! 🌴

[WeatherCondition] at [WeatherTemp] — perfect for an outdoor dinner or stargazing by the pool.

[EveningNote]

[DayLabel] at Inika Resorts 🌿

What's on your agenda for tomorrow? We can arrange it — just reply here or call [ResortPhone].

Enjoy your evening! 🏔️

— Inika`;

function render(booking, extras = {}) {
  return applyPersonalization(TEMPLATE, booking, extras).trim();
}

module.exports = { render };
