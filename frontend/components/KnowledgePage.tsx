"use client";

import { useEffect, useState, FormEvent } from "react";
import { Brain, Upload, FileText, Sparkles, Save, Loader2, Database } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type UploadedFile = {
  name: string;
  size: number;
  modified_at: number;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number) {
  const date = new Date(ts * 1000);
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function KnowledgePage() {
  const [tenantId, setTenantId] = useState("");
  const [token, setToken] = useState("");
  const [baseIdentity, setBaseIdentity] = useState("");
  const [behavioralRules, setBehavioralRules] = useState("");
  const [uploadText, setUploadText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("idle");
  const [indexReady, setIndexReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identityDirty, setIdentityDirty] = useState(false);
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [agentSettings, setAgentSettings] = useState({
    enabled: false,
    response_delay_seconds: 3,
    use_knowledge_base: true,
    use_web_search: true,
    fallback_message: "Thanks for your message! A team member will get back to you shortly.",
  });
  const [savingAgent, setSavingAgent] = useState(false);

  useEffect(() => {
    const tenant = window.localStorage.getItem("axiom_tenant_id");
    const storedToken = window.localStorage.getItem("axiom_token");
    if (!tenant) {
      setError("No tenant found. Please login first.");
      return;
    }
    setTenantId(tenant);
    setToken(storedToken || "");
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;

    const loadIdentity = async () => {
      try {
        const tok = window.localStorage.getItem("axiom_token") || '';
        const identityRes = await fetch(`${API_BASE_URL}/knowledge/identity?tenant_id=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(tok)}`);
        const identityData = (await identityRes.json()) as {
          base_identity?: string;
          behavioral_rules?: string;
          detail?: string;
        };
        if (!active) return;
        if (!identityRes.ok) throw new Error(identityData.detail ?? "Failed loading identity.");
        if (!identityDirty) {
          setBaseIdentity(identityData.base_identity ?? "");
          setBehavioralRules(identityData.behavioral_rules ?? "");
        }
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed loading identity.");
      }
    };

    loadIdentity();
    const tok = window.localStorage.getItem("axiom_token") || '';
    const streamUrl = `${API_BASE_URL}/knowledge/status/stream?tenant_id=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(tok)}`;
    const source = new EventSource(streamUrl);

    source.onmessage = (event) => {
      try {
        const statusData = JSON.parse(event.data) as {
          processing?: boolean;
          progress?: number;
          message?: string;
          files?: UploadedFile[];
          index_exists?: boolean;
        };
        if (!active) return;
        setProcessing(Boolean(statusData.processing));
        setProgress(Number(statusData.progress ?? 0));
        setStatusMessage(statusData.message ?? "idle");
        setFiles(Array.isArray(statusData.files) ? statusData.files : []);
        setIndexReady(Boolean(statusData.index_exists));
        setError(null);
      } catch {
        if (!active) return;
      }
    };

    source.onerror = () => {
    };

    return () => {
      active = false;
      source.close();
    };
  }, [tenantId, identityDirty]);

  useEffect(() => {
    if (!tenantId) return;
    const tok = window.localStorage.getItem("axiom_token") || '';
    fetch(`${API_BASE_URL}/agent/settings?tenant_id=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(tok)}`)
      .then(res => res.json())
      .then(data => {
        setAgentEnabled(data.enabled || false);
        setAgentSettings({
          enabled: data.enabled || false,
          response_delay_seconds: data.response_delay_seconds || 3,
          use_knowledge_base: data.use_knowledge_base !== false,
          use_web_search: data.use_web_search !== false,
          fallback_message: data.fallback_message || "Thanks for your message! A team member will get back to you shortly.",
        });
      })
      .catch(() => {});
  }, [tenantId]);

  const toggleAgent = async () => {
    const newEnabled = !agentEnabled;
    setAgentEnabled(newEnabled);
    setAgentSettings({ ...agentSettings, enabled: newEnabled });
    const tok = window.localStorage.getItem("axiom_token") || '';

    await fetch(`${API_BASE_URL}/agent/settings`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenantId,
        ...agentSettings,
        enabled: newEnabled,
      }),
    });
  };

  const saveAgentSettings = async () => {
    if (!tenantId) return;
    setSavingAgent(true);
    try {
      const tok = window.localStorage.getItem("axiom_token") || '';
      const response = await fetch(`${API_BASE_URL}/agent/settings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          ...agentSettings,
        }),
      });
      if (response.ok) {
        setAgentEnabled(agentSettings.enabled);
      }
    } catch {}
    setSavingAgent(false);
  };

  const onSaveIdentity = async () => {
    if (!tenantId) return;
    setBusy(true);
    setError(null);

    try {
      const tok = window.localStorage.getItem("axiom_token") || '';
      const response = await fetch(`${API_BASE_URL}/knowledge/identity`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          base_identity: baseIdentity,
          behavioral_rules: behavioralRules,
        }),
      });
      const data = (await response.json().catch(() => null)) as { detail?: string } | null;
      if (!response.ok) throw new Error(data?.detail ?? "Failed saving identity.");
      setIdentityDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed saving identity.");
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!tenantId) return;
    if (!uploadText.trim() && !file) {
      setError("Provide text or select a file first.");
      return;
    }
    setBusy(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("tenant_id", tenantId);
      formData.append("text", uploadText);
      if (file) formData.append("file", file);
      const response = await fetch(`${API_BASE_URL}/knowledge/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as { detail?: string } | null;
      if (!response.ok) throw new Error(data?.detail ?? "Upload failed.");
      setUploadText("");
      setFile(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const onUploadZip = async (event: FormEvent) => {
    event.preventDefault();
    if (!tenantId || !zipFile) {
      setError("Select a zip file first.");
      return;
    }
    setBusy(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("tenant_id", tenantId);
      formData.append("zip_file", zipFile);
      const response = await fetch(`${API_BASE_URL}/knowledge/upload-zip`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as { detail?: string; files_processed?: number } | null;
      if (!response.ok) throw new Error(data?.detail ?? "Zip upload failed.");
      setZipFile(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Zip upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const progressWidth = `${Math.max(0, Math.min(100, progress))}%`;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white font-sans text-black selection:bg-black selection:text-white">
      <main className="relative z-10 mx-auto max-w-7xl px-6 py-12">
        <header className="mb-10 border-y border-black bg-white px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="header-icon flex h-10 w-10 items-center justify-center border border-black bg-black text-white">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <h1 className="header-title text-3xl font-black tracking-tight">
                  KNOWLEDGE ENGINE
                </h1>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                  // RAG-powered AI training system
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <StatusBadge
                label="INDEX"
                value={indexReady ? "READY" : "EMPTY"}
                ok={indexReady}
              />
              <StatusBadge
                label="FILES"
                value={String(files.length)}
                ok={true}
              />
              <StatusBadge
                label="STATUS"
                value={processing ? "PROCESSING" : "IDLE"}
                ok={!processing}
              />
              <StatusBadge
                label="AGENT"
                value={agentEnabled ? "ACTIVE" : "OFF"}
                ok={agentEnabled}
              />
            </div>
          </div>
        </header>

        {error && (
          <div className="error-banner mb-6 border border-red-500 bg-red-50 px-4 py-3">
            <p className="font-mono text-xs text-red-600">ERROR: {error}</p>
          </div>
        )}

        {processing && (
          <div className="processing-bar mb-6 border border-black px-4 py-4">
            <div className="mb-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-mono text-xs font-semibold uppercase">Processing</span>
            </div>
            <div className="h-2 w-full bg-gray-200">
              <div
                className="progress-fill h-full bg-black transition-all duration-500"
                style={{ width: progressWidth }}
              />
            </div>
            <p className="mt-2 font-mono text-xs text-gray-500">{statusMessage}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Upload Section */}
          <div className="card-animate border border-black">
            <div className="border-b border-black bg-black px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-white" />
                  <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-white">
                    Document Upload
                  </h2>
                </div>
                <span className="font-mono text-xs text-gray-400">FAISS Index Builder</span>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <form onSubmit={onUpload} className="space-y-4">
                <div>
                  <label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Knowledge Text
                  </label>
                  <textarea
                    value={uploadText}
                    onChange={(e) => setUploadText(e.target.value)}
                    placeholder="Paste your knowledge content here..."
                    className="w-full border border-black px-4 py-3 font-mono text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black min-h-[100px] resize-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Or Upload File (txt, pdf, doc, md)
                  </label>
                  <input
                    type="file"
                    accept=".txt,.pdf,.doc,.docx,.md"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="w-full border border-black bg-gray-50 px-4 py-3 font-mono text-sm file:mr-4 file:cursor-pointer file:border-0 file:bg-black file:px-4 file:py-2 file:font-mono file:text-xs file:font-semibold file:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || (!uploadText.trim() && !file)}
                  className="upload-btn flex w-full items-center justify-center border border-black bg-black py-3 px-4 font-mono text-sm font-medium text-white transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      PROCESSING...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      UPLOAD & TRAIN
                    </span>
                  )}
                </button>
              </form>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-gray-500">
                  // batch upload via zip archive
                </h3>
                <form onSubmit={onUploadZip} className="space-y-4">
                  <div>
                    <label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Upload Zip (contains txt, pdf, zip files)
                    </label>
                    <input
                      type="file"
                      accept=".zip"
                      onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
                      className="w-full border border-black bg-gray-50 px-4 py-3 font-mono text-sm file:mr-4 file:cursor-pointer file:border-0 file:bg-gray-800 file:px-4 file:py-2 file:font-mono file:text-xs file:font-semibold file:text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !zipFile}
                    className="flex w-full items-center justify-center border border-gray-300 py-3 px-4 font-mono text-sm font-medium transition-all hover:border-black hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        PROCESSING...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        EXTRACT & UPLOAD ZIP
                      </span>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* AI Identity */}
            <div className="card-animate border border-black">
              <div className="border-b border-black bg-black px-6 py-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-white" />
                  <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-white">
                    AI Identity
                  </h2>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Base Identity
                  </label>
                  <textarea
                    value={baseIdentity}
                    onChange={(e) => {
                      setBaseIdentity(e.target.value);
                      setIdentityDirty(true);
                    }}
                    placeholder="You are a helpful AI assistant for a hotel concierge..."
                    className="w-full border border-black px-4 py-3 font-mono text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black min-h-[100px] resize-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Behavioral Rules
                  </label>
                  <textarea
                    value={behavioralRules}
                    onChange={(e) => {
                      setBehavioralRules(e.target.value);
                      setIdentityDirty(true);
                    }}
                    placeholder="- Always be polite and professional&#10;- Never share sensitive information&#10;- Confirm details before booking..."
                    className="w-full border border-black px-4 py-3 font-mono text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black min-h-[100px] resize-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={onSaveIdentity}
                  disabled={busy || !identityDirty}
                  className="save-identity-btn flex w-full items-center justify-center border border-black py-3 px-4 font-mono text-sm font-medium transition-all hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      SAVING...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      SAVE IDENTITY
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Uploaded Files */}
            <div className="card-animate border border-black">
              <div className="border-b border-black bg-black px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-white" />
                    <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-white">
                      Uploaded Files
                    </h2>
                  </div>
                  <span className="font-mono text-xs text-gray-400">{files.length} files</span>
                </div>
              </div>
              <div className="p-4">
                {files.length === 0 ? (
                  <div className="py-12 text-center">
                    <Database className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                    <p className="font-mono text-sm text-gray-500">No files uploaded yet</p>
                    <p className="mt-1 font-mono text-xs text-gray-400">Upload documents to build knowledge base</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.map((item, idx) => (
                      <div
                        key={`${item.name}-${item.modified_at}-${idx}`}
                        className="file-item flex items-center justify-between border border-gray-200 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center border border-black bg-gray-100 text-black">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-mono text-sm font-medium">{item.name}</span>
                            <span className="ml-2 font-mono text-xs text-gray-400">{formatSize(item.size)}</span>
                          </div>
                        </div>
                        <span className="font-mono text-xs text-gray-400">{formatDate(item.modified_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Agent Settings */}
          <div className="card-animate border border-black lg:col-span-2">
            <div className="border-b border-black bg-black px-6 py-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-white" />
                <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-white">
                  AI Agent Settings
                </h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-medium">Auto-Reply Agent</p>
                  <p className="font-mono text-xs text-gray-500">Automatically respond to customer messages</p>
                </div>
                <button
                  onClick={toggleAgent}
                  className={`agent-toggle relative h-6 w-12 border-2 transition-all ${
                    agentEnabled ? "border-green-500 bg-green-500" : "border-gray-300 bg-gray-100"
                  }`}
                >
                  <span
                    className={`agent-toggle-dot absolute top-0.5 h-4 w-4 border border-black bg-white transition-all ${
                      agentEnabled ? "left-[calc(100%-18px)]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3 border border-gray-200 p-3">
                  <input
                    type="checkbox"
                    id="useKb"
                    checked={agentSettings.use_knowledge_base}
                    onChange={(e) => setAgentSettings({ ...agentSettings, use_knowledge_base: e.target.checked })}
                    className="h-4 w-4 accent-black"
                  />
                  <label htmlFor="useKb" className="font-mono text-sm">Use Knowledge Base</label>
                </div>
                <div className="flex items-center gap-3 border border-gray-200 p-3">
                  <input
                    type="checkbox"
                    id="useWeb"
                    checked={agentSettings.use_web_search}
                    onChange={(e) => setAgentSettings({ ...agentSettings, use_web_search: e.target.checked })}
                    className="h-4 w-4 accent-black"
                  />
                  <label htmlFor="useWeb" className="font-mono text-sm">Use Web Search</label>
                </div>
              </div>

              <div>
                <label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Fallback Message
                </label>
                <input
                  type="text"
                  value={agentSettings.fallback_message}
                  onChange={(e) => setAgentSettings({ ...agentSettings, fallback_message: e.target.value })}
                  placeholder="Message when agent can't help..."
                  className="w-full border border-black px-4 py-3 font-mono text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <button
                onClick={saveAgentSettings}
                disabled={savingAgent}
                className="save-agent-btn flex w-full items-center justify-center border border-black py-3 px-4 font-mono text-sm font-medium transition-all hover:bg-black hover:text-white disabled:opacity-50"
              >
                {savingAgent ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    SAVING...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    SAVE AGENT SETTINGS
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <footer className="mt-16 border-t border-black bg-black px-6 py-8">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
            <span>KNOWLEDGE_ENGINE v1.0.0</span>
            <span>AXIOM_PLATFORM</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

function StatusBadge({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="status-badge flex items-center gap-2 border border-black px-3 py-1.5">
      <span className={`h-2 w-2 ${ok ? "bg-green-500" : "bg-amber-500"}`}></span>
      <span className="font-mono text-xs font-medium text-black">{label}</span>
      <span className="font-mono text-xs text-gray-500">:</span>
      <span className="font-mono text-xs font-semibold">{value}</span>
    </div>
  );
}