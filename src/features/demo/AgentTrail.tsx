"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface AgentEvent {
  id: string;
  step: string;
  label: string;
  status: "running" | "done" | "error";
  detail?: Record<string, unknown>;
  ts: number;
}

interface AgentTrailProps {
  requestId: string | null;
  userId?: string | null;
}

const STEP_ORDER = [
  "start",
  "classify",
  "curriculum",
  "subject",
  "topic",
  "profile",
  "retrieve",
  "create_materials",
  "teach",
  "save_reply",
  "memory",
  "finish",
];

const STEP_ICONS: Record<string, string> = {
  start: "🚀",
  classify: "🔍",
  curriculum: "📚",
  subject: "📁",
  topic: "📄",
  profile: "👤",
  retrieve: "🗃️",
  create_materials: "🛠️",
  teach: "🎓",
  save_reply: "💾",
  memory: "🧠",
  finish: "✅",
  error: "⚠️",
};

interface StepInfo {
  title: string;
  description: string;
  icon: string;
}

const STEP_INFO: Record<string, StepInfo> = {
  start: { title: "Start", description: "Received the student's message and began the pipeline.", icon: "🚀" },
  classify: { title: "Classifier Agent", description: "Figures out the subject, topic, and intent.", icon: "🔍" },
  curriculum: { title: "Curriculum Agent", description: "Aligns the topic to the Grade 9 Budget of Work.", icon: "📚" },
  subject: { title: "Subject Agent", description: "Finds or creates the subject folder.", icon: "📁" },
  topic: { title: "Topic Agent", description: "Finds or creates the topic card.", icon: "📄" },
  profile: { title: "Profile Agent", description: "Loads the learner's history and adapts the plan.", icon: "👤" },
  retrieve: { title: "Retrieval Agent", description: "Looks for saved flashcards, quizzes, or stories.", icon: "🗃️" },
  create_materials: { title: "Material Creator", description: "Builds clean notes, flashcards, quiz, summary & story.", icon: "🛠️" },
  teach: { title: "Response Agent", description: "Crafts a personalized reply for the student.", icon: "🎓" },
  save_reply: { title: "Save Reply", description: "Stores the conversation in the user's library.", icon: "💾" },
  memory: { title: "Memory Agent", description: "Updates strengths, weaknesses, and learning style.", icon: "🧠" },
  finish: { title: "Finish", description: "All agents done — reply is ready.", icon: "✅" },
  error: { title: "Error", description: "Something went wrong.", icon: "⚠️" },
};

function getStepInfo(event: AgentEvent): StepInfo {
  if (event.step === "retrieve" && /picture|image|ocr|transcrib/i.test(event.label)) {
    return { title: "Vision Agent", description: "Reads the uploaded picture.", icon: "👁️" };
  }
  return STEP_INFO[event.step] || { title: event.step, description: "", icon: STEP_ICONS[event.step] || "⚙️" };
}

function getModelBadge(event: AgentEvent): string | null {
  const runtime = event.detail?.runtime as
    | { provider?: string; model?: string; fallback?: boolean }
    | undefined;
  if (!runtime?.provider) return null;

  const base = runtime.provider === "gemma"
    ? "Gemma"
    : /kimi/i.test(runtime.model || "")
      ? "AMD Fireworks · Kimi"
      : /deepseek/i.test(runtime.model || "")
        ? "AMD Fireworks · DeepSeek"
        : "AMD Fireworks";

  return runtime.fallback ? `Fallback → ${base}` : base;
}

function mergeStageEvents(events: AgentEvent[]): AgentEvent[] {
  const byStep = new Map<string, AgentEvent>();
  for (const event of events) {
    byStep.set(event.step, event);
  }
  return Array.from(byStep.values()).sort((a, b) => {
    const idxA = STEP_ORDER.indexOf(a.step);
    const idxB = STEP_ORDER.indexOf(b.step);
    if (idxA === -1 && idxB === -1) return a.ts - b.ts;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}

function WorkingBubble({ event }: { event?: AgentEvent }) {
  const info = event ? getStepInfo(event) : undefined;
  const model = event ? getModelBadge(event) : null;
  return (
    <div className="mb-4 rounded-xl border border-blue-500/40 bg-blue-950/40 p-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
        {event ? "Working on this" : "Waking up"}
      </p>
      <div className="flex items-center gap-3">
        <div className="text-2xl">{info?.icon || "💬"}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-medium text-slate-100">{info?.title || "Agent team"}</p>
            {model && <ModelBadge label={model} />}
          </div>
          <p className="text-xs text-slate-300">{event?.label || "Getting ready to help with this…"}</p>
        </div>
        <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
      </div>
    </div>
  );
}

function ModelBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-200">
      {label}
    </span>
  );
}

const TOTAL_STEP_UNITS = STEP_ORDER.length - 1;
const IMPORTANT_STEPS = new Set(["classify", "curriculum", "retrieve", "create_materials", "teach", "memory", "error"]);

// Stop polling once a run reaches a terminal state so the monitor does not
// keep spinning after the reply is delivered.
function isTerminal(runEvents: AgentEvent[] | undefined) {
  if (!runEvents || runEvents.length === 0) return false;
  const last = runEvents[runEvents.length - 1];
  return last.step === "finish" || last.status === "error";
}

function StatusBadge({ status }: { status: AgentEvent["status"] }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-900/60 px-2 py-0.5 text-[10px] font-medium text-blue-200">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
        Running
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-900/60 px-2 py-0.5 text-[10px] font-medium text-red-200">
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-900/40 px-2 py-0.5 text-[10px] font-medium text-green-300">
      ✓ Done
    </span>
  );
}

function SkeletonStep({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="relative flex gap-3 pb-4">
          <div className="relative z-10 flex flex-col items-center">
            <div className="h-10 w-10 rounded-full border-2 border-slate-800 bg-slate-800" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
              <div className="h-4 w-1/3 rounded bg-slate-800 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-slate-800 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AgentTrail({ requestId, userId }: AgentTrailProps) {
  const [eventsById, setEventsById] = useState<Record<string, AgentEvent[]>>({});
  const [failuresById, setFailuresById] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const events = useMemo(() => (requestId ? eventsById[requestId] || [] : []), [eventsById, requestId]);
  const failures = useMemo(() => (requestId ? failuresById[requestId] || 0 : 0), [failuresById, requestId]);

  useEffect(() => {
    let cancelled = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const poll = async () => {
      if (!requestId) return;
      setIsLoading(true);
      try {
        const res = await fetch(`/api/agent/run?requestId=${encodeURIComponent(requestId)}`);
        if (!res.ok) {
          if (!cancelled) {
            setFailuresById((prev) => ({ ...prev, [requestId]: (prev[requestId] || 0) + 1 }));
          }
          return;
        }
        const data = (await res.json()) as { run?: { events?: AgentEvent[] } };
        if (!cancelled && data.run?.events) {
          setEventsById((prev) => ({ ...prev, [requestId]: data.run!.events! }));
          setFailuresById((prev) => ({ ...prev, [requestId]: 0 }));
          if (isTerminal(data.run.events)) {
            stopPolling();
          }
        }
      } catch {
        if (!cancelled) {
          setFailuresById((prev) => ({ ...prev, [requestId]: (prev[requestId] || 0) + 1 }));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [requestId]);

  if (!requestId) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-500">
        <p className="mb-2 text-4xl">👀</p>
        <p className="text-sm">Send a message in the chat to see the agents work.</p>
      </div>
    );
  }

  const displayEvents = mergeStageEvents(events);
  const finished = displayEvents.some((e) => e.step === "finish" && e.status === "done");
  const maxIndex = displayEvents.length > 0
    ? Math.max(...displayEvents.map((e) => STEP_ORDER.indexOf(e.step)))
    : -1;
  const progress = finished
    ? 100
    : Math.min(Math.max(Math.round((maxIndex / TOTAL_STEP_UNITS) * 100), 0), 99);

  const runningEvent = [...displayEvents].reverse().find((e) => e.status === "running");
  const finishEvent = displayEvents.find((e) => e.step === "finish" && e.status === "done");
  const visibleEvents = displayEvents.filter((event) => IMPORTANT_STEPS.has(event.step) || Boolean(getModelBadge(event)));
  const completedEvents = displayEvents.filter(
    (event) => visibleEvents.includes(event) && event.status !== "running",
  );
  const createdMaterials = (finishEvent?.detail?.materials_created as string[] | undefined) || [];
  const showRetry = failures >= 3;
  const showLoading = isLoading && events.length === 0 && failures < 3;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100">
      <div className="shrink-0 border-b border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold truncate">Backend Agents Monitor</h2>
          <span className="rounded-full bg-green-900 px-2 py-1 text-xs font-medium text-green-300 shrink-0">
            ● live
          </span>
        </div>
        <div className="mt-1 space-y-1 text-xs text-slate-400">
          {userId ? (
            <p className="truncate">
              Student: <code className="text-slate-300">{userId}</code>
            </p>
          ) : null}
          <p className="truncate">
            Run ID: <code className="text-slate-300">{requestId}</code>
          </p>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>Pipeline progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 min-w-0">
        {showRetry && (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-950/40 p-3">
            <p className="text-xs text-amber-200">
              Agent trail polling failed {failures} times in a row.
            </p>
            <button
              onClick={() => {
                if (requestId) {
                  setFailuresById((prev) => ({ ...prev, [requestId]: 0 }));
                }
              }}
              className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            >
              Retry polling
            </button>
          </div>
        )}

        {showLoading && <SkeletonStep count={2} />}
        {!showLoading && !finished && <WorkingBubble event={runningEvent && (IMPORTANT_STEPS.has(runningEvent.step) || getModelBadge(runningEvent)) ? runningEvent : undefined} />}

        {completedEvents.length > 0 && (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Main agents this turn</p>
        )}
        <div className="relative space-y-0">
          {completedEvents.length > 0 && <div className="absolute bottom-3 left-[19px] top-3 w-px bg-slate-800" />}
          {completedEvents.map((e) => {
            const info = getStepInfo(e);
            const isError = e.status === "error";
            const isDone = e.status === "done";
            const model = getModelBadge(e);
            return (
              <div key={e.id} className="relative flex gap-3 pb-4">
                <div className="relative z-10 flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-lg ${
                      isError
                          ? "border-red-500 bg-red-900"
                          : isDone
                            ? "border-green-500/60 bg-slate-800"
                            : "border-slate-600 bg-slate-800"
                    }`}
                  >
                    {isDone && !isError ? "✓" : info.icon}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                    <div
                      className={`rounded-xl border p-3 ${
                      isError
                          ? "border-red-900/50 bg-red-950/30"
                          : isDone
                            ? "border-slate-800 bg-slate-900/60"
                            : "border-slate-800 bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-medium text-slate-200">{info.title}</p>
                          {model && <ModelBadge label={model} />}
                        </div>
                        <p className="text-xs text-slate-400">{info.description}</p>
                      </div>
                      <StatusBadge status={e.status} />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-300 break-words">{e.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {finished && (
          <div className="mt-2 rounded-xl border border-green-900/50 bg-green-950/30 p-4 text-center">
            <p className="mb-1 text-sm font-bold text-green-300">✨ All agents finished — reply delivered!</p>
            {createdMaterials.length > 0 && (
              <p className="text-xs text-green-400/80">
                Created: {createdMaterials.map((m) => m.replace(/_/g, " ")).join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
