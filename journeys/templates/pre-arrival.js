/**
 * Template: pre-arrival
 * Sent: Day before check-in, 10 AM IST.
 * Re-confirms arrival and builds anticipation.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Hi [Name]! 👋

You\'re checked in for tomorrow at [ResortName]! 🌿

We can\'t wait to welcome you.

📍 [ResortLocation]
📅 [CheckIn] – [CheckOut]
🏡 [Room]
👥 [GuestCount] guest[s/GuestCount]

[OccasionMention]Here\'s a quick note on what to expect:

• The drive to Coorg is part of the experience — winding roads through coffee plantations 🌱
• Pack light layers — Coorg is pleasant year-round
• Your cottage will be ready from [CheckInTime] IST

Have any questions before arrival? Reply here or call us at [ResortPhone].

See you very soon! 🏔️

— Inika`;

function render(booking, extras = {}) {
  return applyPersonalization(TEMPLATE, booking, extras).trim();
}

module.exports = { render };
