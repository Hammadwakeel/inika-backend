"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { profileAPI, ProfileResponse, logout } from "@/lib/api";
import {
  User,
  LogOut,
  Code,
  ShieldCheck,
} from "lucide-react";

const AVATAR_MAX_BYTES = 800_000;

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    profileAPI
      .getMe()
      .then((data) => {
        setProfile(data);
        setFullName(data.full_name || "");
        setAvatarUrl(data.avatar_url || null);
        setIsLoading(false);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ text: "", type: "" });

    try {
      await profileAPI.updateProfile({
        full_name: fullName,
        company_name: "",
      });
      setMessage({ text: "SYSTEM_RECORD_UPDATED", type: "success" });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "UPDATE_FAILED";
      setMessage({ text: msg, type: "error" });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage({ text: "", type: "" }), 4000);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-center font-mono text-white">
        <div className="mb-6 h-1 w-16 animate-pulse bg-white" />
        <p className="text-[10px] uppercase tracking-[0.4em] opacity-50">
          Decrypting_Operator_Profile...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-white font-sans text-black selection:bg-black selection:text-white">
      <header className="border-b border-black bg-white px-6 pb-20 pt-20 text-black">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 inline-flex items-center gap-2 text-black opacity-50">
            <Code className="h-4 w-4" />
            <span className="text-[10px] font-mono uppercase tracking-tighter">
              Operator Designation: {profile?.role || "USER"}
            </span>
          </div>

          <h1 className="text-5xl font-black leading-[0.85] tracking-tighter md:text-[7rem]">
            SYSTEM <br />
            <span className="text-zinc-400">OPERATOR.</span>
          </h1>
        </div>
      </header>

      <section className="bg-[#fcfcfc] px-6 py-20 pb-40">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex items-center gap-4">
            <h2 className="whitespace-nowrap text-xs font-black uppercase tracking-[0.5em]">
              Identity Matrix
            </h2>
            <div className="h-px flex-grow bg-black" />
          </div>

          <div className="mb-20 grid grid-cols-1 gap-px overflow-hidden border border-black bg-black md:grid-cols-12">
            <div className="flex flex-col items-center justify-center border-b border-black bg-white p-12 text-center transition hover:bg-zinc-50 md:col-span-4 md:border-b-0 md:border-r">
              <div className="group relative mb-8">
                <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-2 border-black bg-white">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="h-full w-full object-cover grayscale"
                    />
                  ) : (
                    <User className="h-16 w-16 text-zinc-300" />
                  )}
                </div>
              </div>

              <div className="w-full space-y-4">
                <div className="flex items-center justify-between border-b border-black pb-2">
                  <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                    Clearance
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase">
                    <ShieldCheck className="h-3 w-3" /> {profile?.role || "Standard"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-black pb-2">
                  <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                    UID
                  </span>
                  <span className="text-[10px] font-mono uppercase text-zinc-400">
                    {profile?.id?.split("-")[0] || "UNKNOWN"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-12 transition hover:bg-zinc-50 md:col-span-8">
              {message.text && (
                <div
                  className={`mb-10 flex items-center gap-3 border p-4 text-[10px] font-mono uppercase tracking-widest ${
                    message.type === "error"
                      ? "border-red-500 bg-red-500/10 text-red-600"
                      : "border-black bg-black text-white"
                  }`}
                >
                  <div
                    className={`h-2 w-2 rounded-full ${message.type === "error" ? "bg-red-500" : "animate-pulse bg-white"}`}
                  />
                  {message.text}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-12">
                <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
                  <div>
                    <label className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-black">
                      <User className="h-3 w-3" /> Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter Name"
                      className="w-full rounded-none border-b border-black bg-transparent p-0 pb-4 text-xl font-bold text-black outline-none transition-colors placeholder:text-zinc-300 focus:border-zinc-400"
                    />
                  </div>

                  <div>
                    <label className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                      Tenant ID
                    </label>
                    <input
                      type="text"
                      value={profile?.id || ""}
                      disabled
                      className="w-full cursor-not-allowed rounded-none border-b border-zinc-300 bg-transparent p-0 pb-4 text-lg font-bold text-zinc-500 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-8">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full border border-black bg-black p-6 text-xs font-black uppercase tracking-[0.3em] text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Synchronizing..." : "Commit Protocol Update"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="flex flex-col items-start justify-between gap-8 border border-black bg-white p-8 md:flex-row md:items-center md:p-12">
            <div>
              <h3 className="mb-2 text-xl font-black uppercase">Terminate Session</h3>
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                Sever neural link and clear local token registry.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="group flex w-full items-center justify-center gap-4 border border-black px-8 py-5 text-[10px] font-black uppercase tracking-[0.3em] transition hover:bg-black hover:text-white md:w-auto"
            >
              <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Disconnect
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-900 bg-black px-6 py-12 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-[10px] font-mono text-zinc-700">
          <div>// SECURE_CHANNEL_ACTIVE //</div>
          <div className="uppercase tracking-widest text-zinc-500">Identity Matrix Rendered</div>
        </div>
      </footer>
    </div>
  );
}
