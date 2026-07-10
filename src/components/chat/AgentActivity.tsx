"use client";

import { useEffect, useState } from "react";

export interface AgentEvent {
  id: string;
  step: string;
  label: string;
  status: "running" | "done" | "error";
  detail?: Record<string, unknown>;
  ts: number;
}

interface AgentRun {
  requestId: string;
  userId: string;
  message: string;
  events: AgentEvent[];
}

interface AgentActivityProps {
  requestId: string;
  isActive: boolean;
}

const STEP_META: Record<string, { icon: string; color: string }> = {
  start: { icon: "🚀", color: "text-slate-600" },
  classify: { icon: "🔎", color: "text-blue-600" },
  curriculum: { icon: "📚", color: "text-indigo-600" },
  subject: { icon: "🗂️", color: "text-slate-600" },
  topic: { icon: "📌", color: "text-slate-600" },
  profile: { icon: "👤", color: "text-pink-600" },
  retrieve: { icon: "📂", color: "text-amber-600" },
  create_materials: { icon: "🛠️", color: "text-purple-600" },
  teach: { icon: "🧑‍🏫", color: "text-green-600" },
  memory: { icon: "🧠", color: "text-rose-600" },
  save_reply: { icon: "💾", color: "text-cyan-600" },
  finish: { icon: "✅", color: "text-green-600" },
  error: { icon: "⚠️", color: "text-red-600" },
};

export default function AgentActivity({ requestId, isActive }: AgentActivityProps) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    setOpen(true);
    const controller = new AbortController();

    const poll = async () => {
      try {
        const res = await fetch(`/api/agent/run?requestId=${encodeURIComponent(requestId)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { run?: AgentRun };
        if (data.run) setRun(data.run);
      } catch {
        // ignore
      }
    };

    poll();
    const interval = setInterval(poll, 600);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [requestId, isActive]);

  if (!run && !isActive) return null;

  const events = run?.events || [];
  const last = events[events.length - 1];
  const isFinished = last?.step === "finish" || last?.status === "error";

  return (
    <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${isActive ? "border-blue-200" : "border-slate-200"}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">Agent Activity</span>
          {isActive && !isFinished && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
              </span>
              Live
            </span>
          )}
        </div>
        <span className="text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <p className="text-xs text-slate-500 mb-3">
            {run?.message ? `Processing: “${run.message.slice(0, 60)}${run.message.length > 60 ? "…" : ""}”` : "Waiting for agents…"}
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {events.map((event, idx) => {
              const meta = STEP_META[event.step] || { icon: "⚙️", color: "text-slate-600" };
              const isLastRunning = idx === events.length - 1 && event.status === "running";
              return (
                <div
                  key={event.id}
                  className={`flex items-start gap-3 rounded-xl px-3 py-2 text-sm ${
                    isLastRunning ? "bg-blue-50 border border-blue-100" : "bg-slate-50"
                  }`}
                >
                  <span className={`mt-0.5 ${meta.color}`}>{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">{event.label}</span>
                      <StatusBadge status={event.status} />
                    </div>
                    {event.detail && Object.keys(event.detail).length > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {JSON.stringify(event.detail).slice(0, 90)}
                        {JSON.stringify(event.detail).length > 90 ? "…" : ""}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {events.length === 0 && (
              <div className="text-center text-sm text-slate-400 py-4">Agents are starting up…</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: AgentEvent["status"] }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
        <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Running
      </span>
    );
  }
  if (status === "done") {
    return <span className="text-xs font-medium text-green-600">Done</span>;
  }
  return <span className="text-xs font-medium text-red-600">Error</span>;
}
