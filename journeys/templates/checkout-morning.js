/**
 * Template: checkout-morning
 * Sent: Check-out day, 8 AM IST.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Good morning, [Name]! ☀️

Today is your last day at [ResortName] — check-out by [CheckOutTime] IST.

We hope your stay was everything you hoped for and more. 🌿

A few reminders:

• Please settle your bill at the front desk before departure
• Luggage can be stored at the front desk if you have a late departure
• Breakfast is served until 10 AM ☕

[GroupGreeting]If you have a moment before you go, we\'d love your feedback on your stay — just reply here with any comments or suggestions.

It was truly a pleasure hosting you. Until next time! 🏔️

— Inika, [ResortName]`;

function render(booking, extras = {}) {
  return applyPersonalization(TEMPLATE, booking, extras).trim();
}

module.exports = { render };
