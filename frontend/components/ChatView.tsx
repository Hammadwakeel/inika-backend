"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import AppNav from "./AppNav";
import { MessageSquare, Send, Loader2, Search, X, RefreshCw, RotateCcw } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ChatRow = {
  jid: string;
  name: string;
  last_message: string;
  timestamp: number;
};

type MessageRow = {
  message_id: string;
  jid: string;
  sender: string;
  text: string;
  timestamp: number;
  from_me: number;
};

function formatTime(ts: number) {
  if (!ts) return "--:--";
  const ms = ts > 1_000_000_000_000 ? ts : ts * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDate(ts: number) {
  if (!ts) return "";
  const ms = ts > 1_000_000_000_000 ? ts : ts * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatJid(jid: string): string {
  // Extract number from jid like 923088501890@s.whatsapp.net or 243739729625088@lid
  const match = jid.match(/^(\d+)@/);
  if (match) {
    const num = match[1];
    // Format Pakistani numbers nicely
    if (num.startsWith("92") && num.length === 12) {
      return `+${num.slice(0, 2)} ${num.slice(2, 5)} ${num.slice(5)}`;
    }
    return num;
  }
  return jid.split("@")[0];
}

function getDisplayName(chat: ChatRow): string {
  if (!chat.name || chat.name === chat.jid || chat.name === "Unknown") {
    return formatJid(chat.jid);
  }
  return chat.name;
}

export default function ChatView() {
  const [tenantId, setTenantId] = useState("");
  const [token, setToken] = useState("");
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("pending");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const mainStreamRef = useRef<EventSource | null>(null);
  const messagesStreamRef = useRef<EventSource | null>(null);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const query = searchQuery.toLowerCase();
    return chats.filter(chat =>
      getDisplayName(chat).toLowerCase().includes(query) ||
      formatJid(chat.jid).includes(query) ||
      (chat.last_message || "").toLowerCase().includes(query)
    );
  }, [chats, searchQuery]);

  useEffect(() => {
    const storedTenant = window.localStorage.getItem("axiom_tenant_id");
    const storedToken = window.localStorage.getItem("axiom_token");
    if (!storedTenant) {
      setError("No tenant session found. Please log in first.");
      return;
    }
    setTenantId(storedTenant);
    setToken(storedToken || "");
  }, []);

  useEffect(() => {
    if (!tenantId) return;

    if (mainStreamRef.current) {
      mainStreamRef.current.close();
    }

    const token = window.localStorage.getItem("axiom_token") || '';
    const url = `${API_BASE_URL}/whatsapp/stream?tenant_id=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}`;
    console.log("Connecting to WhatsApp stream:", url);
    const stream = new EventSource(url);
    mainStreamRef.current = stream;

    let qrRefreshInterval: NodeJS.Timeout | null = null;

    stream.onmessage = (event) => {
      console.log("WhatsApp stream data:", event.data);
      const payload = JSON.parse(event.data);
      setLinked(Boolean(payload.linked));
      setStatus(payload.status ?? "pending");
      setQrBase64(payload.qr_base64 ?? null);
      setChats(Array.isArray(payload.chats) ? payload.chats : []);
      setError(null);

      // Auto-refresh QR code every 20 seconds if not linked
      if (!payload.linked && payload.qr_base64) {
        if (!qrRefreshInterval) {
          qrRefreshInterval = setInterval(() => {
            // Force reconnect to get fresh QR
            if (mainStreamRef.current) {
              mainStreamRef.current.close();
            }
            setTimeout(() => {
              const newStream = new EventSource(url);
              mainStreamRef.current = newStream;
            }, 100);
          }, 20000);
        }
      } else if (payload.linked && qrRefreshInterval) {
        clearInterval(qrRefreshInterval);
        qrRefreshInterval = null;
      }
    };
    stream.onerror = (e) => {
      console.error("WhatsApp stream error:", e);
      setError("Live stream disconnected. Retrying...");
    };

    return () => {
      stream.close();
      if (qrRefreshInterval) clearInterval(qrRefreshInterval);
      mainStreamRef.current = null;
    };
  }, [tenantId]);

  const refreshQr = () => {
    if (refreshing || linked) return;
    setRefreshing(true);
    if (mainStreamRef.current) {
      mainStreamRef.current.close();
    }
    setTimeout(() => {
      const token = window.localStorage.getItem("axiom_token") || '';
      const url = `${API_BASE_URL}/whatsapp/stream?tenant_id=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}`;
      const newStream = new EventSource(url);
      mainStreamRef.current = newStream;
      setRefreshing(false);
    }, 100);
  };

  const resetSession = async () => {
    if (resetting) return;
    if (!confirm("This will reset your WhatsApp session. You will need to scan the QR code again. Continue?")) return;
    setResetting(true);
    try {
      const token = window.localStorage.getItem("axiom_token") || '';
      const response = await fetch(`${API_BASE_URL}/whatsapp/restart?tenant_id=${encodeURIComponent(tenantId)}&reset_session=true&token=${encodeURIComponent(token)}`, {
        method: "POST",
      });
      if (response.ok) {
        setLinked(false);
        setQrBase64(null);
        refreshQr();
      }
    } catch (err) {
      console.error("Failed to reset session:", err);
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    if (!chats.length) {
      setSelectedJid(null);
      setMessages([]);
      return;
    }
    if (!selectedJid || !chats.some((c) => c.jid === selectedJid)) {
      setSelectedJid(chats[0].jid);
    }
  }, [chats, selectedJid]);

  useEffect(() => {
    if (!tenantId || !selectedJid) {
      setMessages([]);
      return;
    }

    if (messagesStreamRef.current) {
      messagesStreamRef.current.close();
    }

    const token = window.localStorage.getItem("axiom_token") || '';
    const url = `${API_BASE_URL}/whatsapp/stream?tenant_id=${encodeURIComponent(tenantId)}&jid=${encodeURIComponent(selectedJid)}&token=${encodeURIComponent(token)}`;
    const stream = new EventSource(url);
    messagesStreamRef.current = stream;

    stream.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
    };

    return () => {
      stream.close();
      messagesStreamRef.current = null;
    };
  }, [tenantId, selectedJid]);

  const selectedChat = chats.find((row) => row.jid === selectedJid) ?? null;

  const onSend = async () => {
    if (!tenantId || !selectedJid || !draft.trim() || sending) return;
    const text = draft.trim();
    const optimisticId = `optimistic-${Date.now()}`;
    setSending(true);
    setDraft("");
    setMessages((prev) => [
      ...prev,
      {
        message_id: optimisticId,
        jid: selectedJid,
        sender: "You",
        text,
        timestamp: Math.floor(Date.now() / 1000),
        from_me: 1,
      },
    ]);
    try {
      const response = await fetch(`${API_BASE_URL}/whatsapp/send`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, jid: selectedJid, text }),
      });
      const data = (await response.json().catch(() => null)) as { detail?: string } | null;
      if (!response.ok) {
        throw new Error(data?.detail || "Failed to send message.");
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
      setMessages((prev) => prev.filter((m) => m.message_id !== optimisticId));
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <AppNav />

      <main className="mx-auto max-w-6xl px-8 py-12">
        <header className="mb-12 border-b border-black pb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-black bg-black text-white">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold tracking-tight">WHATSAPP_HUB</h1>
                <p className="font-mono text-xs text-gray-500">// multi-device messaging gateway</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <StatusBadge
                label="CONNECTION"
                value={linked ? "LINKED" : "PENDING"}
                ok={linked}
              />
              <StatusBadge
                label="STATUS"
                value={status.toUpperCase()}
                ok={linked}
              />
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 border border-red-500 bg-red-50 px-4 py-3">
            <p className="font-mono text-xs text-red-600">ERROR: {error}</p>
          </div>
        )}

        {!linked && qrBase64 && (
          <div className="mb-8 border border-black p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-black bg-gray-50">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="font-mono text-lg font-bold uppercase tracking-tight">SCAN_QR_CODE</h3>
              <p className="font-mono text-xs text-gray-500">Open WhatsApp on your phone and scan this code</p>
            </div>
            <div className="mx-auto inline-block border-2 border-black bg-white p-4">
              <img src={qrBase64} alt="WhatsApp QR" className="h-64 w-64 object-contain" />
            </div>
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                onClick={refreshQr}
                disabled={refreshing}
                className="flex items-center gap-2 border border-black px-6 py-3 font-mono text-sm font-medium transition-all hover:bg-black hover:text-white disabled:opacity-50"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                REFRESH QR
              </button>
              <button
                onClick={resetSession}
                disabled={resetting}
                className="flex items-center gap-2 border border-red-500 px-6 py-3 font-mono text-sm font-medium text-red-600 transition-all hover:bg-red-500 hover:text-white disabled:opacity-50"
              >
                {resetting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                RESET SESSION
              </button>
            </div>
          </div>
        )}

        <div className="border border-black">
          <div className="border-b border-black bg-black px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-white">
                CONVERSATIONS
              </h2>
              <span className="font-mono text-xs text-gray-400">{filteredChats.length} / {chats.length}</span>
            </div>
          </div>

          <div className="border-b border-black bg-gray-50 px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full border border-black bg-white py-2 pl-10 pr-10 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex h-[calc(100vh-320px)]">
            <aside className="w-80 shrink-0 border-r border-black overflow-y-auto">
              <div className="max-h-full">
                {filteredChats.length === 0 ? (
                  <div className="p-8 text-center">
                    <MessageSquare className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                    <p className="font-mono text-sm text-gray-500">
                      {searchQuery ? "No matching conversations" : "No conversations yet"}
                    </p>
                  </div>
                ) : (
                  filteredChats.map((chat) => (
                    <button
                      key={chat.jid}
                      type="button"
                      onClick={() => setSelectedJid(chat.jid)}
                      className={`w-full border-b border-black p-4 text-left transition-all hover:bg-gray-50 ${
                        selectedJid === chat.jid ? "bg-black text-white" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center border ${
                          selectedJid === chat.jid ? "border-white bg-white text-black" : "border-black bg-gray-100 text-black"
                        }`}>
                          <span className="font-mono text-xs font-bold">{getDisplayName(chat)[0]?.toUpperCase() || "?"}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="truncate font-mono text-sm font-semibold">{getDisplayName(chat)}</p>
                            <span className="font-mono text-[10px] text-gray-400">{formatDate(chat.timestamp)}</span>
                          </div>
                          <p className="truncate font-mono text-xs text-gray-500">{chat.last_message || "No messages"}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </aside>

            <section className="flex flex-1 flex-col overflow-hidden">
              {selectedChat ? (
                <>
                  <div className="border-b border-black bg-gray-50 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center border border-black bg-black text-white">
                        <span className="font-mono text-xs font-bold">{getDisplayName(selectedChat)[0]?.toUpperCase() || "?"}</span>
                      </div>
                      <div>
                        <h3 className="font-mono text-sm font-bold">{getDisplayName(selectedChat)}</h3>
                        <p className="font-mono text-[10px] text-gray-500">{formatJid(selectedChat.jid)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    {messages.length === 0 ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="text-center">
                          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                          <p className="font-mono text-sm text-gray-500">No messages in this conversation</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((message) => (
                          <div
                            key={message.message_id}
                            className={`flex ${message.from_me ? "justify-end" : "justify-start"}`}
                          >
                            <div className={`max-w-[70%] border px-4 py-3 ${
                              message.from_me
                                ? "border-black bg-black text-white"
                                : "border-black bg-white text-black"
                            }`}>
                              <p className="font-mono text-sm leading-relaxed">{message.text}</p>
                              <p className={`mt-1 font-mono text-[10px] ${message.from_me ? "text-gray-400" : "text-gray-500"}`}>
                                {formatTime(message.timestamp)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-black p-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            onSend();
                          }
                        }}
                        placeholder="Type a message..."
                        disabled={!linked || sending}
                        className="flex-1 border border-black px-4 py-3 font-mono text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100"
                      />
                      <button
                        type="button"
                        onClick={onSend}
                        disabled={!linked || !draft.trim() || sending}
                        className="flex items-center gap-2 border border-black bg-black px-6 py-3 font-mono text-sm font-medium text-white transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        SEND
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <MessageSquare className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                    <p className="font-mono text-sm text-gray-500">Select a conversation to start messaging</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        <footer className="mt-16 border-t border-black pt-8">
          <div className="flex items-center justify-between font-mono text-xs text-gray-400">
            <span>WHATSAPP_HUB v1.0.0</span>
            <span>AXIOM_PLATFORM</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

function StatusBadge({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 border border-black px-3 py-1.5">
      <span className={`h-2 w-2 ${ok ? "bg-green-500" : "bg-amber-500 animate-pulse"}`}></span>
      <span className="font-mono text-xs font-medium text-black">{label}</span>
      <span className="font-mono text-xs text-gray-500">:</span>
      <span className="font-mono text-xs font-semibold">{value}</span>
    </div>
  );
}