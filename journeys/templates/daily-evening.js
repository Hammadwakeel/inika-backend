/**
 * Template: daily-evening
 * Sent: Each full day of stay, 5:30 PM IST.
 * Includes a rotating evening activity recommendation.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Good evening, [Name]! 🌅

How was your [DayLabel] in Coorg? We hope it was wonderful. 🌿

Here\'s what\'s special this evening:

• Dinner at The Coriander: Open until 10 PM 🍽️
• The Cabana poolside is a perfect spot for sunset drinks

[EveningNote]

Reply here or call [ResortPhone] for reservations and any questions. Enjoy your evening! 🏔️

— Inika`;

function render(booking, extras = {}) {
  return applyPersonalization(TEMPLATE, booking, extras).trim();
}

module.exports = { render };
