#!/usr/bin/env node
"use strict";

const fs   = require("fs");
const path = require("path");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
  isJidNewsletter,
} = require("@whiskeysockets/baileys");
const P      = require("pino");
const QRCode = require("qrcode");

// ─── CLI arguments ─────────────────────────────────────────────────────────────
function parseArg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return (i !== -1 && i + 1 < process.argv.length) ? process.argv[i + 1] : fallback;
}

const tenantId  = parseArg("tenant");
const tenantDir = parseArg("tenantDir");
const mode      = parseArg("mode", "daemon");
const sendJid   = parseArg("jid");
const sendText  = parseArg("text");

if (!tenantId || !tenantDir) {
  console.error("Usage: node whatsapp_bridge.js --tenant <id> --tenantDir <path> [--mode daemon|send] [--jid <jid> --text <text>]");
  process.exit(1);
}

// ─── File paths ────────────────────────────────────────────────────────────────
const SESSION_DIR  = path.join(tenantDir, "wa-session");
const STATUS_FILE  = path.join(tenantDir, "wa-status.json");
const CHATS_FILE   = path.join(tenantDir, "wa-chats.json");
const MSGS_FILE    = path.join(tenantDir, "wa-messages.json");
const OUTBOX_FILE  = path.join(tenantDir, "wa-outbox.json");

fs.mkdirSync(SESSION_DIR, { recursive: true });

// ─── JSON helpers ─────────────────────────────────────────────────────────────
const writeJson = (fp, data) => fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8");
const readJson  = (fp, fb = {}) => {
  try { return fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf-8")) : fb; }
  catch (_) { return fb; }
};

// ─── Initial state files ──────────────────────────────────────────────────────
writeJson(STATUS_FILE, { linked: false, qr_base64: null, status: "starting" });
writeJson(CHATS_FILE,  { chats: [] });
writeJson(MSGS_FILE,   { messages: [] });
if (!fs.existsSync(OUTBOX_FILE)) writeJson(OUTBOX_FILE, { messages: [] });

// ─── In-memory stores ─────────────────────────────────────────────────────────
const chatMap        = new Map();
const messageMap     = new Map();
const seenMessageIds = new Set();

// ─── Persistence helpers ───────────────────────────────────────────────────────
function persistChats() {
  const chats = Array.from(chatMap.values())
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  writeJson(CHATS_FILE, { chats });
}

function persistMessages() {
  const messages = Array.from(messageMap.values())
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  writeJson(MSGS_FILE, { messages });
}

function upsertChat({ jid, name, last_message, timestamp }) {
  if (!jid) return;
  const ex        = chatMap.get(jid) || {};
  chatMap.set(jid, {
    jid,
    name:        name        || ex.name        || jid,
    last_message: last_message || ex.last_message || "Recent activity",
    timestamp:   Number(timestamp || ex.timestamp || 0),
  });
}

function upsertMessage({ message_id, jid, sender, text, timestamp, from_me }) {
  if (!message_id || !jid) return;
  if (seenMessageIds.has(message_id)) return;
  seenMessageIds.add(message_id);
  if (seenMessageIds.size > 10000) {
    const arr = Array.from(seenMessageIds);
    seenMessageIds.clear();
    arr.slice(-5000).forEach(id => seenMessageIds.add(id));
  }
  messageMap.set(message_id, {
    message_id,
    jid,
    sender:     sender     || jid,
    text:       text       || "Recent activity",
    timestamp:  Number(timestamp || Math.floor(Date.now() / 1000)),
    from_me:    Boolean(from_me),
  });
}

// ─── Message text extraction ───────────────────────────────────────────────────
function extractText(msg) {
  if (!msg) return "Recent activity";
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.stickerMessage?.caption ||
    msg.reactionMessage?.text ||
    "Recent activity"
  );
}

function toUnixSeconds(v) {
  if (!v) return Math.floor(Date.now() / 1000);
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || Math.floor(Date.now() / 1000);
  if (typeof v === "object" && typeof v.low === "number") return v.low;
  return Math.floor(Date.now() / 1000);
}

// ─── Outbox processor ──────────────────────────────────────────────────────────
async function processOutbox(sock) {
  const payload = readJson(OUTBOX_FILE, { messages: [] });
  const queue   = Array.isArray(payload.messages) ? payload.messages : [];
  if (!queue.length) return;

  const failed = [];
  for (const item of queue) {
    if (!item?.jid || !item?.text) continue;
    try {
      const result  = await sock.sendMessage(item.jid, { text: item.text });
      const ts      = Math.floor(Date.now() / 1000);
      const msgId   = result?.key?.id || `sent-${item.jid}-${ts}`;
      upsertMessage({ message_id: msgId, jid: item.jid, sender: "You", text: item.text, timestamp: ts, from_me: true });
      upsertChat({ jid: item.jid, name: item.jid, last_message: item.text, timestamp: ts });
    } catch (_) {
      failed.push(item);
    }
  }
  writeJson(OUTBOX_FILE, { messages: failed });
  persistMessages();
  persistChats();
}

// ─── Daemon mode ───────────────────────────────────────────────────────────────
async function startDaemon() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  let linked       = false;
  let reconnecting = false;
  let latestQr     = null;
  let sockRef       = null; // hold reference so setInterval can access it

  const updateStatus = (patch) =>
    writeJson(STATUS_FILE, { linked, qr_base64: latestQr, status: "linked", ...patch });

  const startSocket = async () => {
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      auth:                state,
      version,
      printQRInTerminal:   false,
      logger:              P({ level: "error" }),
      syncFullHistory:     false,
      fireInitQueries:     true,
      markOnlineOnConnect: false,
      browser:            Browsers.macOS("Axiom"),
    });
    sockRef = sock;

    // ── credentials ──────────────────────────────────────────────────────────
    sock.ev.on("creds.update", saveCreds);

    // ── chats ────────────────────────────────────────────────────────────────
    sock.ev.on("chats.set", ({ chats }) => {
      (chats || []).forEach(c =>
        upsertChat({
          jid:          c.id || "",
          name:         c.name || c.pushName || c.notify || c.id || "Unknown",
          last_message: c.lastMessage?.conversation || "Recent activity",
          timestamp:    Number(c.conversationTimestamp || 0),
        })
      );
      persistChats();
    });

    sock.ev.on("chats.upsert", (chats) => {
      (chats || []).forEach(c =>
        upsertChat({
          jid:          c.id || "",
          name:         c.name || c.pushName || c.notify || c.id || "Unknown",
          last_message: c.lastMessage?.conversation || "Recent activity",
          timestamp:    Number(c.conversationTimestamp || 0),
        })
      );
      persistChats();
    });

    sock.ev.on("chats.update", (updates) => {
      (updates || []).forEach(u =>
        upsertChat({
          jid:          u.id,
          name:         u.name || u.pushName || u.notify || u.id || "Unknown",
          last_message: "Recent activity",
          timestamp:    Number(u.conversationTimestamp || 0),
        })
      );
      persistChats();
    });

    sock.ev.on("contacts.upsert", (contacts) => {
      (contacts || []).forEach(c => {
        const jid = c?.id;
        if (!jid || jid === "status@broadcast") return;
        upsertChat({ jid, name: c.name || c.notify || c.verifiedName || jid, last_message: "Recent activity", timestamp: Math.floor(Date.now() / 1000) });
      });
      persistChats();
    });

    // ── messages ─────────────────────────────────────────────────────────────
    sock.ev.on("messages.upsert", ({ messages, type }) => {
      console.log(`[BRIDGE] messages.upsert type=${type} count=${messages?.length || 0}`);
      if (type !== "notify") return;

      (messages || []).forEach(msg => {
        const jid    = msg?.key?.remoteJid;
        const msgId  = msg?.key?.id;
        const fromMe = msg?.key?.fromMe === true;
        if (!jid || jid === "status@broadcast" || isJidNewsletter(jid)) return;

        const text      = extractText(msg?.message);
        const timestamp = toUnixSeconds(msg?.messageTimestamp);
        const sender    = fromMe ? "You" : (msg?.pushName || jid);

        upsertChat({ jid, name: sender, last_message: text, timestamp });
        upsertMessage({ message_id: msgId || `${jid}-${timestamp}`, jid, sender, text, timestamp, from_me: fromMe });
      });

      persistMessages();
      persistChats();
    });

    // ── connection ───────────────────────────────────────────────────────────
    sock.ev.on("connection.update", async ({ connection, qr, lastDisconnect }) => {
      if (qr) {
        latestQr = await QRCode.toDataURL(qr);
        updateStatus({ qr_base64: latestQr, status: "awaiting_scan" });
      }

      if (connection === "open") {
        linked       = true;
        reconnecting = false;
        console.log("[BRIDGE] Connected");
        updateStatus({ linked: true, status: "linked" });
        writeJson(path.join(tenantDir, "reconnect-attempts.json"), { attempts: 0 });
      }

      if (connection === "close") {
        linked = false;
        const reason     = lastDisconnect?.error?.message || "connection_closed";
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut  = statusCode === DisconnectReason.loggedOut;

        updateStatus({ linked: false, status: reason });

        if (loggedOut) {
          console.log("[BRIDGE] Session expired — manual re-link required");
          return;
        }

        if (!reconnecting) {
          reconnecting = true;
          const attempts = (() => {
            const a    = parseInt(readJson(path.join(tenantDir, "reconnect-attempts.json"), { attempts: 0 }).attempts || "0", 10);
            const next = a + 1;
            writeJson(path.join(tenantDir, "reconnect-attempts.json"), { attempts: next });
            return next;
          })();

          const delay     = Math.min(1000 * Math.pow(2, Math.min(attempts, 8)), 300_000);
          const actual    = delay + Math.random() * 1000;

          console.log(`[BRIDGE] Reconnecting in ${Math.round(actual / 1000)}s (attempt ${attempts})`);
          updateStatus({ status: `reconnecting_attempt_${attempts}_in_${Math.round(actual / 1000)}s` });

          setTimeout(() => {
            startSocket().catch(err => {
              console.error(`[BRIDGE] Restart failed: ${err?.message || err}`);
              reconnecting = false;
            });
          }, actual);
        }
      }
    });
  };

  // ── periodic housekeeping ───────────────────────────────────────────────────
  setInterval(() => {
    if (!linked || !sockRef) return;
    try {
      persistChats();
      persistMessages();
      processOutbox(sockRef).catch(() => {});
    } catch (_) {}
  }, 5000);

  await startSocket();
  // keep alive
  await new Promise(() => {});
}

// ─── One-shot send mode ────────────────────────────────────────────────────────
async function sendOnce() {
  if (!sendJid || !sendText) throw new Error("Missing --jid or --text");

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version }           = await fetchLatestBaileysVersion();

  await new Promise((resolve, reject) => {
    let settled = false;
    const sock  = makeWASocket({
      auth:                state,
      version,
      printQRInTerminal:   false,
      logger:              P({ level: "error" }),
      markOnlineOnConnect: false,
      browser:            Browsers.macOS("Axiom"),
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
      if (connection === "open" && !settled) {
        try {
          const result = await sock.sendMessage(sendJid, { text: sendText });
          settled = true;
          process.stdout.write(JSON.stringify({
            ok:         true,
            jid:        sendJid,
            text:       sendText,
            message_id: result?.key?.id || "",
            timestamp:  Math.floor(Date.now() / 1000),
          }));
          await sock.logout().catch(() => {});
          resolve();
        } catch (err) {
          settled = true;
          reject(err);
        }
      }
      if (connection === "close" && !settled) {
        settled = true;
        reject(lastDisconnect?.error || new Error("Connection closed before send"));
      }
    });

    setTimeout(() => { if (!settled) { settled = true; reject(new Error("Timeout")); } }, 45_000);
  });
}

// ─── Entry point ───────────────────────────────────────────────────────────────
if (mode === "send") {
  sendOnce().catch(err => { process.stderr.write(String(err?.message || err)); process.exit(1); });
} else {
  startDaemon().catch(err => { process.stderr.write(String(err?.message || err)); process.exit(1); });
}
