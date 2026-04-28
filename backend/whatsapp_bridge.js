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
  Browsers,
  isJidNewsletter
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
    msg.stickerMessage?.caption ||
    msg.reactionMessage?.text ||
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
  const seenMessageIds = new Set();

  writeJson(statusFile, { tenant_id: tenantId, linked: false, qr_base64: null, status: "starting" });
  writeJson(chatsFile, { tenant_id: tenantId, chats: [] });
  writeJson(messagesFile, { tenant_id: tenantId, messages: [] });
  if (!fs.existsSync(outboxFile)) {
    writeJson(outboxFile, { messages: [] });
  }

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

    if (seenMessageIds.has(entry.message_id)) {
      return;
    }
    seenMessageIds.add(entry.message_id);

    if (seenMessageIds.size > 10000) {
      const arr = Array.from(seenMessageIds);
      seenMessageIds.clear();
      arr.slice(-5000).forEach(id => seenMessageIds.add(id));
    }

    messageMap.set(entry.message_id, {
      message_id: entry.message_id,
      jid: entry.jid,
      sender: entry.sender || entry.jid,
      text: entry.text || "Recent activity",
      timestamp: Number(entry.timestamp || Math.floor(Date.now() / 1000)),
      from_me: Boolean(entry.from_me)
    });
  };

  const processOutbox = async (sock) => {
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
        const sentMsgId = result?.key?.id || `sent-${jid}-${timestamp}`;
        upsertMessage({
          message_id: sentMsgId,
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

  const startSocket = async () => {
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      logger: P({ level: "silent" }),
      syncFullHistory: false,
      fireInitQueries: true,
      markOnlineOnConnect: false,
      browser: Browsers.macOS("Axiom Desktop")
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("chats.set", ({ chats }) => {
      const compact = compactChats(chats || []);
      compact.forEach(upsertChat);
      persistChatMap();
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

    sock.ev.on("messages.upsert", ({ messages, type }) => {
      console.log(`[BRIDGE] messages.upsert: type=${type}, count=${messages?.length || 0}`);

      // Only process 'notify' type for incoming messages
      if (type !== "notify") return;

      (messages || []).forEach((message) => {
        const jid = message?.key?.remoteJid;
        if (!jid || jid === "status@broadcast" || isJidNewsletter(jid)) return;

        const text = extractMessageText(message?.message);
        const timestamp = messageTimestampToNumber(message?.messageTimestamp);
        const msgId = message?.key?.id;
        const isFromMe = message?.key?.fromMe === true;
        const senderName = isFromMe ? "You" : (message?.pushName || jid);

        console.log(`[BRIDGE] Message: id=${msgId}, jid=${jid}, from_me=${isFromMe}, text="${text.substring(0, 50)}"`);

        upsertChat({
          jid,
          name: senderName,
          last_message: text,
          timestamp
        });
        upsertMessage({
          message_id: msgId || `${jid}-${timestamp}`,
          jid,
          sender: senderName,
          text,
          timestamp,
          from_me: isFromMe
        });
      });
      persistMessageMap();
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
        console.log("[BRIDGE] Connected to WhatsApp");
        writeJson(path.join(tenantDir, "reconnect-attempts.json"), { attempts: 0 });
        writeJson(statusFile, {
          tenant_id: tenantId,
          linked: true,
          qr_base64: latestQr,
          status: "linked"
        });
      }

      if (connection === "close") {
        linked = false;
        console.log("[BRIDGE] Disconnected");
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
          const baseDelay = 1000;
          const maxDelay = 300000;
          let attempts = parseInt(readJson(path.join(tenantDir, "reconnect-attempts.json"), { attempts: 0 }).attempts || 0, 10);
          attempts++;
          writeJson(path.join(tenantDir, "reconnect-attempts.json"), { attempts });

          const delay = Math.min(baseDelay * Math.pow(2, Math.min(attempts, 8)), maxDelay);
          const jitter = Math.random() * 1000;
          const actualDelay = delay + jitter;

          console.log(`[BRIDGE] Reconnecting in ${Math.round(actualDelay / 1000)}s (attempt ${attempts})`);
          writeJson(statusFile, {
            tenant_id: tenantId,
            linked: false,
            qr_base64: latestQr,
            status: `reconnecting_attempt_${attempts}_in_${Math.round(actualDelay / 1000)}s`
          });

          setTimeout(() => {
            startSocket().catch((err) => {
              console.error(`[BRIDGE] Restart failed: ${err?.message || err}`);
              reconnecting = false;
            });
          }, actualDelay);
        }
      }
    });

    // Periodically persist and process outbox
    setInterval(() => {
      if (!linked) return;
      try {
        persistChatMap();
        persistMessageMap();
        processOutbox(sock).catch(() => {});
      } catch (_) {}
    }, 5000);
  };

  await startSocket();

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
