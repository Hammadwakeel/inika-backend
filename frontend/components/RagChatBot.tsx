"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Brain, Send, Loader2, ChevronDown, ChevronUp, ExternalLink, Copy, CheckCheck, MessageSquare, Loader, Sparkles } from "lucide-react";
import AppNav from "./AppNav";
import gsap from "gsap";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { source: string; text: string }[];
  source_type?: string;
  rag_score?: number;
};

type StreamEvent = {
  type: "status" | "context" | "source" | "token" | "error" | "done";
  content?: string;
  source?: string;
  text?: string;
  live?: boolean;
  score?: number;
};

export default function RagChatBot() {
  const [tenantId, setTenantId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [streamingStatus, setStreamingStatus] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedTenant = window.localStorage.getItem("axiom_tenant_id");
    if (storedTenant) {
      setTenantId(storedTenant);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleSources = (msgId: string) => {
    setShowSources((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const copyToClipboard = async (text: string, msgId: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(msgId);
    setTimeout(() => setCopied(null), 2000);
  };

  const sendMessage = useCallback(async () => {
    if (!tenantId || !input.trim() || loading) return;

    const userMsg = input.trim();
    const tempId = `temp-${Date.now()}`;
    setInput("");
    setLoading(true);
    setError(null);

    setMessages((prev) => [
      ...prev,
      { id: tempId, role: "user", content: userMsg },
    ]);

    try {
      const token = window.localStorage.getItem("axiom_token") || "";
      const url = `${API_BASE_URL}/rag/query/stream?tenant_id=${encodeURIComponent(tenantId)}&user_message=${encodeURIComponent(userMsg)}&guest_id=guest&token=${encodeURIComponent(token)}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      let assistantId = `assistant-${Date.now()}`;
      let buffer = "";
      let sources: { source: string; text: string }[] = [];
      let source_type = "faiss";
      let rag_score: number | undefined;
      let currentStatus = "";
      let isDone = false;
      setIsStreaming(true);
      setStreamingStatus("connecting");

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      eventSource.onmessage = (event) => {
        const data: StreamEvent = JSON.parse(event.data);

        switch (data.type) {
          case "status":
            currentStatus = data.content || "";
            setStreamingStatus(currentStatus);
            // Update message with status
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: `[${currentStatus.toUpperCase()}]` }
                  : m
              )
            );
            // Animate status indicator
            if (statusRef.current) {
              gsap.to(statusRef.current, {
                opacity: 0.5,
                duration: 0.2,
                yoyo: true,
                repeat: 1,
              });
            }
            break;
          case "context":
            source_type = data.source || "faiss";
            rag_score = data.score;
            break;
          case "source":
            sources.push({ source: data.source || "unknown", text: data.text || "" });
            break;
          case "token":
            buffer += data.content || "";
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: buffer }
                  : m
              )
            );
            break;
          case "done":
            isDone = true;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, sources, source_type, rag_score }
                  : m
              )
            );
            eventSource.close();
            setLoading(false);
            setIsStreaming(false);
            setStreamingStatus("");
            break;
          case "error":
            if (!isDone) {
              setError(data.content || "An error occurred");
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
              eventSource.close();
              setLoading(false);
              setIsStreaming(false);
              setStreamingStatus("");
            }
            break;
        }
      };

      eventSource.onerror = () => {
        // Only show error if stream didn't complete successfully
        if (!isDone) {
          setError("Connection lost. Please try again.");
          eventSource.close();
          setLoading(false);
          setIsStreaming(false);
          setStreamingStatus("");
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setLoading(false);
    }
  }, [tenantId, input, loading]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <AppNav />

      <main className="mx-auto max-w-4xl px-8 py-12">
        <header className="mb-12 border-b border-black pb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-black bg-black text-white">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold tracking-tight">RAG_CHATBOT</h1>
              <p className="font-mono text-xs text-gray-500">// knowledge-powered AI assistant</p>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 border border-red-500 bg-red-50 px-4 py-3">
            <p className="font-mono text-xs text-red-600">ERROR: {error}</p>
          </div>
        )}

        {isStreaming && streamingStatus && (
          <div ref={statusRef} className="mb-6 flex items-center gap-3 border border-black bg-black px-4 py-3">
            <div className="relative">
              <Sparkles className="h-4 w-4 animate-pulse text-white" />
              <div className="absolute inset-0 animate-ping">
                <Sparkles className="h-4 w-4 text-white/50" />
              </div>
            </div>
            <span className="font-mono text-xs font-medium uppercase tracking-wider text-white">
              {streamingStatus}
            </span>
            <span className="ml-auto font-mono text-xs text-white/50 animate-pulse">
              STREAMING...
            </span>
          </div>
        )}

        <div className="border border-black">
          <div className="border-b border-black bg-black px-6 py-4">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-white">
              CONVERSATION
            </h2>
          </div>

          <div className="h-[calc(100vh-400px)] overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Brain className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                  <h3 className="mb-2 font-mono text-lg font-semibold">Start a conversation</h3>
                  <p className="font-mono text-sm text-gray-500">
                    Ask questions about your knowledge base
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`message-item space-y-3 ${message.role === "user" ? "user-message" : "assistant-message"}`}
                    style={{
                      animation: index === messages.length - 1 && loading && message.role === "assistant" ? "fadeInUp 0.3s ease-out" : "none"
                    }}
                  >
                    <div
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`message-bubble max-w-[80%] border px-4 py-3 transition-all duration-300 ${
                          message.role === "user"
                            ? "border-black bg-black text-white"
                            : "border-black bg-white text-black"
                        } hover:shadow-lg`}
                      >
                        <div className="flex items-start gap-2">
                          <MessageSquare className="mt-1 h-4 w-4 shrink-0" />
                          <p className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content || (loading && message.role === "assistant" ? "" : "")}
                          </p>
                          {loading && message.role === "assistant" && !message.content && (
                            <span className="typing-indicator ml-2 flex gap-1">
                              <span></span>
                              <span></span>
                              <span></span>
                            </span>
                          )}
                        </div>
                        {message.role === "assistant" && message.content && (
                          <div className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-3">
                            <button
                              onClick={() => copyToClipboard(message.content, message.id)}
                              className="flex items-center gap-1 font-mono text-xs text-gray-500 hover:text-black transition-colors"
                            >
                              {copied === message.id ? (
                                <CheckCheck className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              {copied === message.id ? "Copied" : "Copy"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                      <div className="ml-4">
                        <button
                          onClick={() => toggleSources(message.id)}
                          className="flex items-center gap-2 font-mono text-xs text-gray-500 hover:text-black transition-colors"
                        >
                          {showSources[message.id] ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          {message.sources.length} source{message.sources.length !== 1 ? "s" : ""}
                          {message.rag_score !== undefined && (
                            <span className="text-gray-400">
                              (score: {message.rag_score.toFixed(2)})
                            </span>
                          )}
                        </button>

                        {showSources[message.id] && (
                          <div className="mt-3 space-y-3">
                            {message.sources.map((source, idx) => (
                              <div
                                key={idx}
                                className="border border-gray-200 bg-gray-50 p-4"
                              >
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="font-mono text-xs font-semibold text-gray-600">
                                    SOURCE {idx + 1}
                                  </span>
                                  <a
                                    href={source.source.startsWith("http") ? source.source : "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 font-mono text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    {source.source.length > 40
                                      ? source.source.substring(0, 40) + "..."
                                      : source.source}
                                  </a>
                                </div>
                                <p className="font-mono text-xs text-gray-700 leading-relaxed">
                                  {source.text.length > 300
                                    ? source.text.substring(0, 300) + "..."
                                    : source.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-black p-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask a question about your knowledge base..."
                disabled={!tenantId || loading}
                className="flex-1 border border-black px-4 py-3 font-mono text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!tenantId || !input.trim() || loading}
                className="send-btn flex items-center gap-2 border border-black bg-black px-6 py-3 font-mono text-sm font-medium text-white transition-all duration-300 hover:scale-105 hover:bg-gray-800 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                )}
                SEND
              </button>
            </div>
          </div>
        </div>

        <footer className="mt-16 border-t border-black pt-8">
          <div className="flex items-center justify-between font-mono text-xs text-gray-400">
            <span>RAG_CHATBOT v1.0.0</span>
            <span>AXIOM_PLATFORM</span>
          </div>
        </footer>
      </main>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .typing-indicator {
          display: inline-flex;
          gap: 4px;
          padding: 4px 0;
        }
        .typing-indicator span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #666;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .typing-indicator span:nth-child(1) {
          animation-delay: -0.32s;
        }
        .typing-indicator span:nth-child(2) {
          animation-delay: -0.16s;
        }
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
        .message-bubble {
          transform-origin: left center;
        }
        .user-message .message-bubble {
          transform-origin: right center;
        }
        .message-item {
          animation: fadeInUp 0.3s ease-out;
        }
        .user-message {
          animation: slideInRight 0.3s ease-out;
        }
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .assistant-message {
          animation: slideInLeft 0.3s ease-out;
        }
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
