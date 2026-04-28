"use client";

import { useState, useEffect } from "react";
import { Bot, Globe, BookOpen, Save, Loader2 } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface AgentSettings {
  auto_reply_enabled: boolean;
  use_web_search: boolean;
  use_knowledge_base: boolean;
}

export default function AgentSettings() {
  const [tenantId, setTenantId] = useState("");
  const [settings, setSettings] = useState<AgentSettings>({
    auto_reply_enabled: false,
    use_web_search: false,
    use_knowledge_base: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("axiom_tenant_id");
    if (stored) {
      setTenantId(stored);
      fetchSettings(stored);
    }
  }, []);

  const fetchSettings = async (tenantId: string) => {
    setLoading(true);
    try {
      const token = window.localStorage.getItem("axiom_token") || "";
      const response = await fetch(
        `${API_BASE_URL}/settings/agent?tenant_id=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}`
      );
      if (response.ok) {
        const data = await response.json();
        setSettings({
          auto_reply_enabled: data.auto_reply_enabled ?? false,
          use_web_search: data.use_web_search ?? false,
          use_knowledge_base: data.use_knowledge_base ?? true,
        });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!tenantId) return;
    setSaving(true);
    setMessage(null);
    try {
      const token = window.localStorage.getItem("axiom_token") || "";
      const response = await fetch(
        `${API_BASE_URL}/settings/agent?tenant_id=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            auto_reply_enabled: settings.auto_reply_enabled,
            use_web_search: settings.use_web_search,
            use_knowledge_base: settings.use_knowledge_base,
          }),
        }
      );
      if (response.ok) {
        setMessage({ type: "success", text: "Settings saved successfully!" });
      } else {
        setMessage({ type: "error", text: "Failed to save settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof AgentSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-black pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border border-black bg-black text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold tracking-tight">AGENT_SETTINGS</h1>
            <p className="font-mono text-xs text-gray-500">// Configure AI auto-response behavior</p>
          </div>
        </div>
      </header>

      {message && (
        <div className={`border px-4 py-3 ${message.type === "success" ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}>
          <p className="font-mono text-xs">{message.text}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Auto Reply Toggle */}
        <div className="border border-black bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center border ${settings.auto_reply_enabled ? "border-green-500 bg-green-50" : "border-gray-300 bg-gray-50"}`}>
                <Bot className={`h-5 w-5 ${settings.auto_reply_enabled ? "text-green-600" : "text-gray-400"}`} />
              </div>
              <div>
                <h3 className="font-mono text-sm font-semibold">AUTO_REPLY_ENABLED</h3>
                <p className="font-mono text-xs text-gray-500">
                  When enabled, the AI will automatically respond to WhatsApp messages
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggle("auto_reply_enabled")}
              className={`relative h-8 w-14 rounded-full transition-colors ${
                settings.auto_reply_enabled ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  settings.auto_reply_enabled ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Use Knowledge Base Toggle */}
        <div className="border border-black bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center border ${settings.use_knowledge_base ? "border-black bg-black" : "border-gray-300 bg-gray-50"}`}>
                <BookOpen className={`h-5 w-5 ${settings.use_knowledge_base ? "text-white" : "text-gray-400"}`} />
              </div>
              <div>
                <h3 className="font-mono text-sm font-semibold">USE_KNOWLEDGE_BASE</h3>
                <p className="font-mono text-xs text-gray-500">
                  When enabled, the AI will search your uploaded documents for answers
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggle("use_knowledge_base")}
              className={`relative h-8 w-14 rounded-full transition-colors ${
                settings.use_knowledge_base ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  settings.use_knowledge_base ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Use Web Search Toggle */}
        <div className="border border-black bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center border ${settings.use_web_search ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"}`}>
                <Globe className={`h-5 w-5 ${settings.use_web_search ? "text-blue-600" : "text-gray-400"}`} />
              </div>
              <div>
                <h3 className="font-mono text-sm font-semibold">USE_WEB_SEARCH</h3>
                <p className="font-mono text-xs text-gray-500">
                  When enabled, the AI can search the web for real-time information (weather, news, etc.)
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggle("use_web_search")}
              className={`relative h-8 w-14 rounded-full transition-colors ${
                settings.use_web_search ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  settings.use_web_search ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={saveSettings}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 border border-black bg-black px-6 py-3 font-mono text-sm font-medium text-white transition-all hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        SAVE_SETTINGS
      </button>

      <div className="border-t border-black pt-6">
        <div className="flex items-center justify-between font-mono text-xs text-gray-400">
          <span>AGENT_SETTINGS v1.0.0</span>
          <span>INIKA_BOT</span>
        </div>
      </div>
    </div>
  );
}
