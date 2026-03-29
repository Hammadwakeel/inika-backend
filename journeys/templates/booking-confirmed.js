/**
 * Template: booking-confirmed
 * Sent: Immediately when a new CONFIRMED booking is first detected.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `[WelcomeBack]

We\'re delighted to confirm your reservation at [ResortName] in [ResortLocation].

🏡 [Room] — [Nights] night[s/Nights]
📅 [CheckIn] → [CheckOut]
👥 [GuestCount] guest[s/GuestCount]

[OccasionMention][RequestsNote]

Our team is already preparing your stay. Here\'s a quick overview:

• Check-in: [CheckInTime] IST
• Check-out: [CheckOutTime] IST
• Complimentary breakfast included
• WiFi available throughout the property

Need anything before you arrive? Reach us anytime at [ResortPhone] or reply here.

We look forward to welcoming you! 🌿

— Inika, your virtual concierge at [ResortName]
[WeatherNote]`;

function render(booking, extras = {}) {
  return applyPersonalization(TEMPLATE, booking, extras).trim();
}

module.exports = { render };
