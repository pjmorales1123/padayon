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
  teach: { title: "Teaching Agent", description: "Writes the personalized reply using Gemma.", icon: "🎓" },
  save_reply: { title: "Save Reply", description: "Stores the conversation in the user's library.", icon: "💾" },
  memory: { title: "Memory Agent", description: "Updates strengths, weaknesses, and learning style.", icon: "🧠" },
  finish: { title: "Finish", description: "All agents done — reply is ready.", icon: "✅" },
  error: { title: "Error", description: "Something went wrong.", icon: "⚠️" },
};

const TOTAL_STEP_UNITS = STEP_ORDER.length - 1;

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

export default function AgentTrail({ requestId }: AgentTrailProps) {
  const [eventsById, setEventsById] = useState<Record<string, AgentEvent[]>>({});
  const [failuresById, setFailuresById] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const events = useMemo(() => (requestId ? eventsById[requestId] || [] : []), [eventsById, requestId]);
  const failures = useMemo(() => (requestId ? failuresById[requestId] || 0 : 0), [failuresById, requestId]);

  useEffect(() => {
    let cancelled = false;

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
    const interval = setInterval(poll, 500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [requestId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [events]);

  if (!requestId) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-500">
        <p className="mb-2 text-4xl">👀</p>
        <p className="text-sm">Send a message in the chat to see the agents work.</p>
      </div>
    );
  }

  const finished = events.some((e) => e.step === "finish" && e.status === "done");
  const currentStep = events.length > 0 ? events[events.length - 1].step : null;
  const currentIndex = currentStep ? STEP_ORDER.indexOf(currentStep) : -1;
  const progress = finished
    ? 100
    : Math.min(Math.max(Math.round((currentIndex / TOTAL_STEP_UNITS) * 100), 0), 99);

  const runningEvent = [...events].reverse().find((e) => e.status === "running");
  const finishEvent = events.find((e) => e.step === "finish" && e.status === "done");
  const createdMaterials = (finishEvent?.detail?.materials_created as string[] | undefined) || [];
  const showRetry = failures >= 3;
  const showLoading = isLoading && events.length === 0 && failures < 3;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold truncate">Backend Agents Monitor</h2>
          <span className="rounded-full bg-green-900 px-2 py-1 text-xs font-medium text-green-300 shrink-0">
            ● live
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400 truncate">
          Request ID: <code className="text-slate-300">{requestId}</code>
        </p>
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

      <div className="flex-1 overflow-y-auto p-4 min-w-0">
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

        {showLoading && <SkeletonStep />}

        {runningEvent && (
          <div className="mb-4 rounded-xl border border-blue-500/40 bg-blue-950/40 p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
              Currently working
            </p>
            <div className="flex items-center gap-3">
              <div className="text-2xl">{STEP_INFO[runningEvent.step]?.icon || STEP_ICONS[runningEvent.step] || "⚙️"}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-100 truncate">
                  {STEP_INFO[runningEvent.step]?.title || runningEvent.step}
                </p>
                <p className="text-xs text-slate-300 truncate">{runningEvent.label}</p>
              </div>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent shrink-0" />
            </div>
            {runningEvent.detail && Object.keys(runningEvent.detail).length > 0 && (
              <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950/80 p-2 text-[10px] text-slate-400">
                {JSON.stringify(runningEvent.detail, null, 2)}
              </pre>
            )}
          </div>
        )}

        <div className="relative space-y-0">
          {events.length > 0 && <div className="absolute bottom-3 left-[19px] top-3 w-px bg-slate-800" />}
          {events.map((e) => {
            const info = STEP_INFO[e.step] || { title: e.step, description: "", icon: STEP_ICONS[e.step] || "⚙️" };
            const isRunning = e.status === "running";
            const isError = e.status === "error";
            const isDone = e.status === "done";
            const showDetail = isRunning || (isError && e.detail);
            return (
              <div key={e.id} className="relative flex gap-3 pb-4">
                <div className="relative z-10 flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-lg ${
                      isRunning
                        ? "border-blue-400 bg-blue-600"
                        : isError
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
                      isRunning
                        ? "border-blue-500/30 bg-blue-950/20"
                        : isError
                          ? "border-red-900/50 bg-red-950/30"
                          : isDone
                            ? "border-slate-800 bg-slate-900/60"
                            : "border-slate-800 bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{info.title}</p>
                        <p className="text-xs text-slate-400">{info.description}</p>
                      </div>
                      <StatusBadge status={e.status} />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-300 break-words">{e.label}</p>
                    {showDetail && e.detail && Object.keys(e.detail).length > 0 && (
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-2 text-[10px] text-slate-400">
                        {JSON.stringify(e.detail, null, 2)}
                      </pre>
                    )}
                    {!showDetail && e.detail && Object.keys(e.detail).length > 0 && (
                      <p className="mt-1 text-[10px] text-slate-500">{Object.keys(e.detail).join(" · ")}</p>
                    )}
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
        <div ref={scrollRef} />
      </div>
    </div>
  );
}
