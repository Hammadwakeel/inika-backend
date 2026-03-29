/**
 * Template: checkin-morning
 * Sent: Check-in day, 8 AM IST — for guests arriving morning/early afternoon.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Good morning, [Name]! ☀️

Your cottage at [ResortName] is all set and ready for you! 🌿

📅 Today is the day — check-in from [CheckInTime] IST
🏡 [Room]

[Acknowledgment][GroupGreeting]

A few things to know as you arrive:

• The Coriander restaurant opens for lunch at noon — we\'d love to have you
• Complimentary breakfast is included with your stay
• The pool is open all day for your enjoyment

If you need anything, reply here or call [ResortPhone].

Welcome to Coorg! We\'re so glad you\'re here.

— Inika 🌿`;

function render(booking, extras = {}) {
  const acknowledgment = booking.booking_source !== 'direct'
    ? `We see you\'re booked through ${booking.booking_source} — all confirmed on our end! `
    : '';
  return applyPersonalization(TEMPLATE, { ...booking, acknowledgment }, extras).trim();
}

module.exports = { render };
