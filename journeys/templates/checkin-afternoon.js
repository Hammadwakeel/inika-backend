/**
 * Template: checkin-afternoon
 * Sent: Check-in day, 12 PM IST — for guests arriving midday/afternoon.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Hi [Name]! 🌿

Your cottage is ready and waiting for you!

🏡 [Room] — checked in [CheckIn]
[GroupGreeting]

You\'ve arrived at a beautiful time of day in Coorg. A few quick tips:

• Lunch at The Coriander is available now — authentic Kodava flavors and more 🌿
• The pool is perfect right now if you\'d like a dip
• The outdoor cafe is open for fresh coffee and light snacks

[Acknowledgment]

If you need anything at all, reply here or reach us at [ResortPhone]. Enjoy your first moments in Coorg!

— Inika`;

function render(booking, extras = {}) {
  const acknowledgment = booking.booking_source !== 'direct'
    ? `All confirmed from ${booking.booking_source} — you\'re all set! `
    : '';
  return applyPersonalization(TEMPLATE, { ...booking, acknowledgment }, extras).trim();
}

module.exports = { render };
