/**
 * Template: daily-morning
 * Sent: Each full day of stay, 8:30 AM IST.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Good morning, [Name]! ☀️

[DayLabel] at Inika Resorts 🌿

[WeatherCondition] and [WeatherTemp] in Coorg — a beautiful day ahead!

Here's what's on today:
• Complimentary yoga at 8 AM — join us if you like!
• Breakfast at The Coriander, 7:30 – 10 AM
• Pool and grounds open all day 🏊

Our team is on hand for anything you need. Reply here or call [ResortPhone].

Enjoy every moment! 🌿

— Inika`;

function render(booking, extras = {}) {
  return applyPersonalization(TEMPLATE, booking, extras).trim();
}

module.exports = { render };
