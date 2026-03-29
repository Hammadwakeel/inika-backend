/**
 * Template: post-stay
 * Sent: Day after checkout, 10 AM IST.
 * Thank-you message, solicits review, plants seed for rebooking.
 */

const { applyPersonalization } = require('../../lib/personalization');

const TEMPLATE = `Hi [Name]! 🌿

The whole team at [ResortName] in Coorg wanted to say a heartfelt thank you for choosing us.

We hope your time here was peaceful, restorative, and full of beautiful moments. 🌄

If you have a few minutes, we\'d be so grateful for your feedback — just reply here or leave us a review online. Your words help other travelers discover Coorg.

And when you\'re ready for your next escape, we\'ll be right here waiting. Use code RETURN10 for a 10% discount on your next booking! 🌿

Until the mountains call again,

— Veema & the Inika team
[ResortName] | [ResortLocation]
[ResortPhone] | veema@inikaresorts.com`;

function render(booking, extras = {}) {
  return applyPersonalization(TEMPLATE, booking, extras).trim();
}

module.exports = { render };
