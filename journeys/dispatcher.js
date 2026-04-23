/**
 * journeys/dispatcher.js
 * Sends WhatsApp messages via the OpenClaw gateway HTTP API.
 */

const fs = require('fs');
const path = require('path');

const GATEWAY_HOST = process.env.OPENCLAW_GATEWAY_HOST || 'http://localhost:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '29bf7d33e39c658c896c386783429be3e31ed23682129c69';
const SESSION_KEY = process.env.OPENCLAW_SESSION_KEY || 'agent:main:whatsapp';

const FAILED_FILE = path.join(__dirname, 'failed-messages.json');

/**
 * Send a WhatsApp message via the OpenClaw gateway.
 *
 * @param {string} to — E.164 phone number
 * @param {string} body — message text
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendMessage(to, body) {
  const endpoint = `${GATEWAY_HOST}/tools/invoke`;

  const payload = {
    tool: 'message',
    args: {
      action: 'send',
      channel: 'whatsapp',
      account: 'default',
      to,
      message: body,
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err = `Gateway HTTP ${response.status}: ${text}`;
      console.error(`[dispatcher] Send failed to ${to}:`, err);
      logFailure(to, body, err);
      return { success: false, error: err };
    }

    const data = await response.json();
    console.log(`[dispatcher] Sent to ${to} — OK`);
    return { success: true };
  } catch (err) {
    console.error(`[dispatcher] Send error to ${to}:`, err.message);
    logFailure(to, body, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Log a failed message for later review.
 * @param {string} to
 * @param {string} body
 * @param {string} error
 */
function logFailure(to, body, error) {
  let failures = [];
  try {
    failures = JSON.parse(fs.readFileSync(FAILED_FILE, 'utf8'));
  } catch {}

  failures.push({
    to,
    body: body.substring(0, 200),
    error,
    timestamp: new Date().toISOString(),
  });

  // Keep last 100 failures
  failures = failures.slice(-100);

  fs.writeFileSync(FAILED_FILE, JSON.stringify(failures, null, 2));
}

module.exports = { sendMessage };
