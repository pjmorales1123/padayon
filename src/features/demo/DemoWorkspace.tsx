"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ChatWorkspace from "@/features/chat/ChatWorkspace";
import { buildAppHref } from "@/lib/navigation";
import AgentTrail from "./AgentTrail";
import LearnerSummary from "./LearnerSummary";
import { DEMO_PERSONAS } from "./demo-personas";

interface DemoWorkspaceProps {
  initialUserId: string;
}

type MobileTab = "chat" | "profile" | "agents";

const MOBILE_TABS: { key: MobileTab; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "profile", label: "Profile" },
  { key: "agents", label: "Agents" },
];

export default function DemoWorkspace({ initialUserId }: DemoWorkspaceProps) {
  const router = useRouter();
  const [userId, setUserId] = useState(initialUserId);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [resetState, setResetState] = useState<"idle" | "working" | "success" | "error">("idle");
  const [resetError, setResetError] = useState<string | null>(null);
  const [initialPrompt, setInitialPrompt] = useState("");
  const [autoSend, setAutoSend] = useState(false);
  const [promptKey, setPromptKey] = useState(0);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

  if (userId !== initialUserId) {
    setUserId(initialUserId);
  }

  useEffect(() => {
    if (resetState !== "success") return;
    const timeout = setTimeout(() => setResetState("idle"), 3000);
    return () => clearTimeout(timeout);
  }, [resetState]);

  const handlePersonaChange = (selectedId: string) => {
    if (selectedId === userId) return;
    router.replace(buildAppHref("/demo", selectedId), { scroll: false });
    setActiveRequestId(null);
    setInitialPrompt("");
    setAutoSend(false);
    setPromptKey((k) => k + 1);
    setRefreshKey((k) => k + 1);
  };

  const sendPersonaPrompt = (prompt: string) => {
    setActiveRequestId(null);
    setInitialPrompt(prompt);
    setAutoSend(true);
    setPromptKey((k) => k + 1);
  };

  const handleReset = async () => {
    setResetState("working");
    setResetError(null);
    try {
      const res = await fetch("/api/seed-personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Reset failed");
      }
      setRefreshKey((k) => k + 1);
      setActiveRequestId(null);
      setResetState("success");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Reset failed");
      setResetState("error");
    }
  };

  const panelClass = (tab: MobileTab) => {
    const activeMobile = mobileTab === tab ? "block" : "hidden";
    return `${activeMobile} md:block min-h-0 overflow-hidden`;
  };

  return (
    <main className="flex h-screen flex-col bg-slate-100 overflow-hidden pb-16">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            P
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-slate-900 truncate">PADAYON Demo</h1>
            <p className="text-xs text-slate-500 truncate">Learner summary · Chat · Live agent trail</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <select
            aria-label="Persona"
            value={userId}
            onChange={(e) => handlePersonaChange(e.target.value)}
            disabled={activeRequestId !== null}
            className="text-sm rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 max-w-[9rem] sm:max-w-none truncate"
            title="Choose a demo persona"
          >
            {DEMO_PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.label}
              </option>
            ))}
          </select>
          <Link
            href={buildAppHref("/profile", userId)}
            className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            title="View this persona's profile"
          >
            Profile
          </Link>
          <button
            onClick={handleReset}
            disabled={resetState === "working" || activeRequestId !== null}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            title="Reset demo personas"
          >
            {resetState === "working" ? "Resetting..." : "Reset"}
          </button>
        </div>
      </header>

      {resetState === "success" && (
        <div className="shrink-0 bg-green-100 px-4 py-2 text-center text-sm font-medium text-green-800">
          Demo personas reset.
        </div>
      )}
      {resetState === "error" && resetError && (
        <div className="shrink-0 bg-red-100 px-4 py-2 text-center text-sm font-medium text-red-800">
          {resetError}
        </div>
      )}

      <div className="md:hidden shrink-0 border-b border-slate-200 bg-white px-4">
        <div className="flex gap-2" role="tablist" aria-label="Demo panels">
          {MOBILE_TABS.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={mobileTab === key}
              onClick={() => setMobileTab(key)}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition ${
                mobileTab === key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-4 [grid-template-columns:minmax(0,1fr)] md:[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)] lg:[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className={`${panelClass("profile")} md:col-span-2 lg:col-span-1`}>
          <LearnerSummary userId={userId} refreshKey={refreshKey} />
        </div>

        <div className={`${panelClass("chat")} flex min-w-0 flex-col gap-3`}>
          <div className="flex-1 min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ChatWorkspace
              key={`${userId}-${promptKey}`}
              embedded
              initialModel="auto"
              userId={userId}
              initialPrompt={initialPrompt}
              autoSend={autoSend}
              initialRequestId={activeRequestId ?? undefined}
              onRequestStart={setActiveRequestId}
              onRequestComplete={setActiveRequestId}
            />
          </div>

          <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Try these judge prompts
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO_PERSONAS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => sendPersonaPrompt(p.prompt)}
                  disabled={activeRequestId !== null}
                  className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                >
                  {p.prompt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`${panelClass("agents")} min-w-0`}>
          <AgentTrail requestId={activeRequestId} />
        </div>
      </div>
    </main>
  );
}
