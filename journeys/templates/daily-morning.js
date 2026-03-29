/**
 * Template: daily-morning
 * Sent: Each full day of stay, 8:30 AM IST.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Good morning, [Name]! ☀️

[DayLabel] at [ResortName] — hope you slept well in Coorg! 🌿

[WeatherNote]

Here\'s your day at a glance:

• Breakfast: The Coriander, 7:30 – 10 AM ☕
• Lunch: The Coriander & The Cabana, 12 – 3 PM 🍽️
• Pool: Open all day 🏊
• Guided experiences available — just ask!

Our team is on hand for anything you need. Reply here or call [ResortPhone].

Enjoy every moment! 🏔️

— Inika`;

function render(booking, extras = {}) {
  return applyPersonalization(TEMPLATE, booking, extras).trim();
}

module.exports = { render };
