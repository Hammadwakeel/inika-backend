/**
 * Template: checkin-evening
 * Sent: Check-in day, 5 PM IST — for guests arriving late afternoon/evening.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Good evening, [Name]! 🌙

Welcome to [ResortName] in Coorg! Your cottage awaits.

🏡 [Room]
📅 [CheckIn] → [CheckOut]

[Acknowledgment][OccasionMention]

A few things for this evening:

• Dinner at The Coriander is open until 10 PM — we\'d love to have you for dinner tonight
• The outdoor cafe is a lovely spot for an evening coffee
• The pool is open until 9 PM if you\'d like a moonlit swim

Tomorrow morning, breakfast is served from 7:30 AM. ☕

Anything you need before tomorrow? We\'re just a message away at [ResortPhone].

Sleep well in Coorg! 🌿

— Inika`;

function render(booking, extras = {}) {
  const acknowledgment = booking.booking_source !== 'direct'
    ? `All confirmed from ${booking.booking_source} — you\'re all set! `
    : '';
  return applyPersonalization(TEMPLATE, { ...booking, acknowledgment }, extras).trim();
}

module.exports = { render };
