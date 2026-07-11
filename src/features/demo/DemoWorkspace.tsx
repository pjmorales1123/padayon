"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNavigation from "@/components/navigation/AppNavigation";
import ChatWorkspace from "@/features/chat/ChatWorkspace";
import { buildAppHref } from "@/lib/navigation";
import AgentTrail from "./AgentTrail";
import LearnerSummary from "./LearnerSummary";
import { DEMO_PERSONAS } from "./demo-personas";

interface DemoWorkspaceProps {
  initialUserId: string;
}

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

  return (
    <main className="flex h-screen flex-col bg-slate-100">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            P
          </div>
          <div>
            <h1 className="font-bold text-slate-900">PADAYON Demo</h1>
            <p className="text-xs text-slate-500">Learner summary · Chat · Live agent trail</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <AppNavigation userId={userId} busy={!!activeRequestId} />

          <label htmlFor="persona-select" className="sr-only">
            Learner persona
          </label>
          <select
            id="persona-select"
            value={userId}
            onChange={(e) => handlePersonaChange(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DEMO_PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleReset}
            disabled={resetState === "working"}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {resetState === "working" ? "Resetting..." : "Reset personas"}
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        <div className="min-h-0 overflow-hidden">
          <LearnerSummary userId={userId} refreshKey={refreshKey} />
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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

        <div className="min-h-0 overflow-hidden">
          <AgentTrail requestId={activeRequestId} />
        </div>
      </div>
    </main>
  );
}
