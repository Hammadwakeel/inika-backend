#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const P = require("pino");
const QRCode = require("qrcode");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} = require("@whiskeysockets/baileys");

function parseArg(name, fallback = "") {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

const tenantId = parseArg("--tenant");
const tenantDir = parseArg("--tenantDir");
const mode = parseArg("--mode", "daemon");
const sendJid = parseArg("--jid");
const sendText = parseArg("--text");

if (!tenantId || !tenantDir) {
  console.error("Missing --tenant or --tenantDir");
  process.exit(1);
}

const sessionDir = path.join(tenantDir, "wa-session");
const statusFile = path.join(tenantDir, "wa-status.json");
const chatsFile = path.join(tenantDir, "wa-chats.json");
const messagesFile = path.join(tenantDir, "wa-messages.json");
const outboxFile = path.join(tenantDir, "wa-outbox.json");
fs.mkdirSync(sessionDir, { recursive: true });

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

function readJson(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (e) {}
  return fallback;
}

function compactChats(chats) {
  return chats.map((chat) => ({
    jid: chat.id || "",
    name: chat.name || chat.pushName || chat.notify || chat.id || "Unknown",
    last_message: chat.lastMessage?.conversation || "Recent activity",
    timestamp: Number(chat.conversationTimestamp || 0)
  }));
}

function extractMessageText(msg) {
  if (!msg) return "Recent activity";
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    "Recent activity"
  );
}

function messageTimestampToNumber(value) {
  if (!value) return Math.floor(Date.now() / 1000);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || Math.floor(Date.now() / 1000);
  if (typeof value === "object" && typeof value.low === "number") {
    return value.low;
  }
  return Math.floor(Date.now() / 1000);
}

async function startDaemon() {
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  let latestQr = null;
  let reconnecting = false;
  let linked = false;
  const chatMap = new Map();
  const messageMap = new Map();

  writeJson(statusFile, { tenant_id: tenantId, linked: false, qr_base64: null, status: "starting" });
  writeJson(chatsFile, { tenant_id: tenantId, chats: [] });
  writeJson(messagesFile, { tenant_id: tenantId, messages: [] });
  if (!fs.existsSync(outboxFile)) {
    writeJson(outboxFile, { messages: [] });
  }

  const startSocket = async () => {
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      logger: P({ level: "silent" }),
      syncFullHistory: true,
      fireInitQueries: true,
      markOnlineOnConnect: false,
      shouldSyncHistoryMessage: () => true,
      browser: Browsers.macOS("Axiom Desktop")
    });

    sock.ev.on("creds.update", saveCreds);

    const persistChatMap = () => {
      const chats = Array.from(chatMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      writeJson(chatsFile, { tenant_id: tenantId, chats });
    };

    const upsertChat = (entry) => {
      if (!entry?.jid) return;
      const existing = chatMap.get(entry.jid);
      const merged = {
        jid: entry.jid,
        name: entry.name || existing?.name || entry.jid,
        last_message: entry.last_message || existing?.last_message || "Recent activity",
        timestamp: Number(entry.timestamp || existing?.timestamp || 0)
      };
      chatMap.set(entry.jid, merged);
    };

    const persistMessageMap = () => {
      const messages = Array.from(messageMap.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      writeJson(messagesFile, { tenant_id: tenantId, messages });
    };

    const upsertMessage = (entry) => {
      if (!entry?.message_id || !entry?.jid) return;
      messageMap.set(entry.message_id, {
        message_id: entry.message_id,
        jid: entry.jid,
        sender: entry.sender || entry.jid,
        text: entry.text || "Recent activity",
        timestamp: Number(entry.timestamp || Math.floor(Date.now() / 1000)),
        from_me: Boolean(entry.from_me)
      });
    };

    const processOutbox = async () => {
      if (!linked) return;
      let payload;
      try {
        payload = JSON.parse(fs.readFileSync(outboxFile, "utf-8"));
      } catch (_) {
        payload = { messages: [] };
      }
      const queue = Array.isArray(payload?.messages) ? payload.messages : [];
      if (!queue.length) return;

      const remaining = [];
      for (const item of queue) {
        const jid = item?.jid;
        const text = item?.text;
        if (!jid || !text) continue;
        try {
          const result = await sock.sendMessage(jid, { text });
          const timestamp = Math.floor(Date.now() / 1000);
          upsertMessage({
            message_id: result?.key?.id || `sent-${jid}-${timestamp}`,
            jid,
            sender: "You",
            text,
            timestamp,
            from_me: true
          });
          upsertChat({
            jid,
            name: jid,
            last_message: text,
            timestamp
          });
        } catch (_) {
          remaining.push(item);
        }
      }
      writeJson(outboxFile, { messages: remaining });
      persistMessageMap();
      persistChatMap();
    };

    const seedFromContacts = () => {
      // Fallback now relies on contacts.upsert events only for this Baileys version.
      persistChatMap();
    };

    sock.ev.on("chats.set", ({ chats }) => {
      const compact = compactChats(chats || []);
      compact.forEach(upsertChat);
      persistChatMap();
    });

    sock.ev.on("messaging-history.set", ({ chats, messages }) => {
      const compact = compactChats(chats || []);
      compact.forEach(upsertChat);
      (messages || []).forEach((message) => {
        const jid = message?.key?.remoteJid;
        if (!jid || jid === "status@broadcast") return;
        const text = extractMessageText(message?.message);
        const timestamp = messageTimestampToNumber(message?.messageTimestamp);
        upsertChat({
          jid,
          name: message?.pushName || message?.key?.participant || jid,
          last_message: text,
          timestamp
        });
        upsertMessage({
          message_id: message?.key?.id || `${jid}-${timestamp}`,
          jid,
          sender: message?.pushName || message?.key?.participant || jid,
          text,
          timestamp,
          from_me: Boolean(message?.key?.fromMe)
        });
      });
      persistChatMap();
      persistMessageMap();
    });

    sock.ev.on("chats.upsert", (chats) => {
      const compact = compactChats(chats || []);
      compact.forEach(upsertChat);
      persistChatMap();
    });

    sock.ev.on("chats.update", (updates) => {
      (updates || []).forEach((chat) => {
        upsertChat({
          jid: chat.id,
          name: chat.name || chat.pushName || chat.notify || chat.id || "Unknown",
          last_message: "Recent activity",
          timestamp: Number(chat.conversationTimestamp || 0)
        });
      });
      persistChatMap();
    });

    sock.ev.on("messages.upsert", (payload) => {
      (payload?.messages || []).forEach((message) => {
        const jid = message?.key?.remoteJid;
        if (!jid || jid === "status@broadcast") return;
        const text = extractMessageText(message?.message);
        const timestamp = messageTimestampToNumber(message?.messageTimestamp);
        const senderName =
          message?.pushName ||
          message?.key?.participant ||
          jid;
        upsertChat({
          jid,
          name: senderName,
          last_message: text,
          timestamp
        });
        upsertMessage({
          message_id: message?.key?.id || `${jid}-${timestamp}`,
          jid,
          sender: senderName,
          text,
          timestamp,
          from_me: Boolean(message?.key?.fromMe)
        });
      });
      persistChatMap();
      persistMessageMap();
    });

    sock.ev.on("contacts.upsert", (contacts) => {
      (contacts || []).forEach((contact) => {
        const jid = contact?.id;
        if (!jid || jid === "status@broadcast") return;
        upsertChat({
          jid,
          name: contact?.name || contact?.notify || contact?.verifiedName || jid,
          last_message: "Recent activity",
          timestamp: Math.floor(Date.now() / 1000)
        });
      });
      persistChatMap();
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        latestQr = await QRCode.toDataURL(qr);
        writeJson(statusFile, {
          tenant_id: tenantId,
          linked: false,
          qr_base64: latestQr,
          status: "awaiting_scan"
        });
      }

      if (connection === "open") {
        reconnecting = false;
        linked = true;
        // Reset reconnect attempts on successful connection
        writeJson(path.join(tenantDir, "reconnect-attempts.json"), { attempts: 0 });
        writeJson(statusFile, {
          tenant_id: tenantId,
          linked: true,
          qr_base64: latestQr,
          status: "linked"
        });
        // Some Baileys versions don't expose sock.chats.all().
        // Keep linked state stable and only update chats if API exists.
        try {
          if (sock.chats && typeof sock.chats.all === "function") {
            const chats = await sock.chats.all();
            const compact = compactChats(chats || []);
            compact.forEach(upsertChat);
            persistChatMap();
          }
          if (chatMap.size === 0) {
            seedFromContacts();
          }
        } catch (_) {
          // Ignore chat bootstrap failures; chats.set events can still populate later.
          if (chatMap.size === 0) {
            seedFromContacts();
          }
        }
      }

      if (connection === "close") {
        linked = false;
        const reason = lastDisconnect?.error?.message || "connection_closed";
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        writeJson(statusFile, {
          tenant_id: tenantId,
          linked: false,
          qr_base64: latestQr,
          status: reason
        });
        if (shouldReconnect && !reconnecting) {
          reconnecting = true;
          const baseDelay = 1000; // 1 second
          const maxDelay = 300000; // 5 minutes
          const attemptKey = `reconnect_attempts_${tenantId}`;
          let attempts = parseInt(readJson(path.join(tenantDir, "reconnect-attempts.json"), { attempts: 0 }).attempts || 0, 10);
          attempts++;
          writeJson(path.join(tenantDir, "reconnect-attempts.json"), { attempts });

          // Exponential backoff with jitter: min(delay * 2^attempts, maxDelay) + random(0-1000)
          const delay = Math.min(baseDelay * Math.pow(2, Math.min(attempts, 8)), maxDelay);
          const jitter = Math.random() * 1000;
          const actualDelay = delay + jitter;

          writeJson(statusFile, {
            tenant_id: tenantId,
            linked: false,
            qr_base64: latestQr,
            status: `reconnecting_attempt_${attempts}_in_${Math.round(actualDelay / 1000)}s`
          });

          setTimeout(() => {
            startSocket().catch((err) => {
              writeJson(statusFile, {
                tenant_id: tenantId,
                linked: false,
                qr_base64: latestQr,
                status: `restart_failed:${String(err?.message || err)}`
              });
              reconnecting = false;
            });
          }, actualDelay);
        }
      }
    });

    // Snapshot chats from Baileys in-memory store periodically.
    setInterval(() => {
      if (!linked) return;
      try {
        // Keep file fresh even if only message events populate chatMap.
        persistChatMap();
        persistMessageMap();
        processOutbox().catch(() => {});
      } catch (_) {
        // Ignore snapshot failures.
      }
    }, 5000);
  };

  await startSocket();

  // Keep process alive; parent API process controls lifecycle.
  setInterval(() => {}, 60_000);
}

async function sendOnce() {
  if (!sendJid || !sendText) {
    throw new Error("Missing --jid or --text for send mode");
  }
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  await new Promise((resolve, reject) => {
    let settled = false;
    const sock = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      logger: P({ level: "silent" }),
      markOnlineOnConnect: false,
      browser: Browsers.macOS("Axiom Desktop")
    });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
      if (connection === "open" && !settled) {
        try {
          const result = await sock.sendMessage(sendJid, { text: sendText });
          settled = true;
          process.stdout.write(
            JSON.stringify({
              ok: true,
              jid: sendJid,
              text: sendText,
              message_id: result?.key?.id || "",
              timestamp: Math.floor(Date.now() / 1000),
              from_me: true
            })
          );
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

    setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Timed out while sending message"));
      }
    }, 45000);
  });
}

if (mode === "send") {
  sendOnce().catch((err) => {
    process.stderr.write(String(err?.message || err));
    process.exit(1);
  });
} else {
  startDaemon()
    .then(() => {
      if (mode !== "daemon") {
        process.stdout.write(JSON.stringify({ ok: true }));
      }
    })
    .catch((err) => {
      process.stderr.write(String(err?.message || err));
      process.exit(1);
    });
}
