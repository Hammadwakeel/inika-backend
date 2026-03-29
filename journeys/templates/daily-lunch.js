/**
 * Template: daily-lunch
 * Sent: Each full day of stay, 12 PM IST.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Hi [Name]! 🍽️

Lunch is served!

📍 The Coriander — multi-cuisine, local Kodava specialties
📍 The Cabana — poolside platters and fresh juices by the water

Today\'s specials feature fresh, locally sourced ingredients from the Coorg region. 🌿

Reservations welcome — just reply here or call [ResortPhone].

Enjoy your afternoon! ☀️

— Inika`;

function render(booking, extras = {}) {
  return applyPersonalization(TEMPLATE, booking, extras).trim();
}

module.exports = { render };
