"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const DEFAULT_DEMO_USER_ID = "demo-user-id";

interface AgentEvent {
  id: string;
  step: string;
  label: string;
  status: "running" | "done" | "error";
  detail?: Record<string, unknown>;
  ts: number;
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

function MonitorPanel({ requestId }: { requestId: string }) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/agent/run?requestId=${encodeURIComponent(requestId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.run?.events && !cancelled) {
          setEvents(data.run.events);
        }
      } catch {
        // ignore polling errors
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
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const completedSteps = new Set(events.filter((e) => e.status === "done").map((e) => e.step));
  const progress = Math.round((completedSteps.size / (STEP_ORDER.length - 1)) * 100);
  const isFinished = events.some((e) => e.step === "finish" && e.status === "done");
  const runningEvent = [...events].reverse().find((e) => e.status === "running");
  const finishEvent = events.find((e) => e.step === "finish" && e.status === "done");
  const createdMaterials = (finishEvent?.detail?.materials_created as string[] | undefined) || [];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 rounded-2xl overflow-hidden border border-slate-800">
      <div className="p-4 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">Backend Agents Monitor</h2>
          <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-900 text-green-300">
            ● live
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Request ID: <code className="text-slate-300">{requestId}</code>
        </p>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Pipeline progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {events.length === 0 && (
          <div className="text-center text-slate-500 mt-10">
            <p className="text-4xl mb-2">👀</p>
            <p className="text-sm">Send a message in the chat to see the agents work.</p>
          </div>
        )}

        {runningEvent && (
          <div className="mb-4 rounded-xl border border-blue-500/40 bg-blue-950/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-blue-300 font-semibold mb-1">
              Currently working
            </p>
            <div className="flex items-center gap-3">
              <div className="text-2xl">{STEP_INFO[runningEvent.step]?.icon || STEP_ICONS[runningEvent.step] || "⚙️"}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100">
                  {STEP_INFO[runningEvent.step]?.title || runningEvent.step}
                </p>
                <p className="text-xs text-slate-300">{runningEvent.label}</p>
              </div>
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
            {runningEvent.detail && Object.keys(runningEvent.detail).length > 0 && (
              <pre className="mt-2 text-[10px] text-slate-400 bg-slate-950/80 p-2 rounded-lg overflow-x-auto">
                {JSON.stringify(runningEvent.detail, null, 2)}
              </pre>
            )}
          </div>
        )}

        <div className="relative space-y-0">
          {events.length > 0 && (
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-slate-800" />
          )}
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
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 ${
                      isRunning
                        ? "bg-blue-600 border-blue-400"
                        : isError
                        ? "bg-red-900 border-red-500"
                        : isDone
                        ? "bg-slate-800 border-green-500/60"
                        : "bg-slate-800 border-slate-600"
                    }`}
                  >
                    {isDone && !isError ? "✓" : info.icon}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`rounded-xl border p-3 ${
                      isRunning
                        ? "bg-blue-950/20 border-blue-500/30"
                        : isError
                        ? "bg-red-950/30 border-red-900/50"
                        : isDone
                        ? "bg-slate-900/60 border-slate-800"
                        : "bg-slate-900 border-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-200">{info.title}</p>
                        <p className="text-xs text-slate-400">{info.description}</p>
                      </div>
                      <StatusBadge status={e.status} />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-300">{e.label}</p>
                    {showDetail && e.detail && Object.keys(e.detail).length > 0 && (
                      <pre className="mt-2 text-[10px] text-slate-400 bg-slate-950 p-2 rounded-lg overflow-x-auto">
                        {JSON.stringify(e.detail, null, 2)}
                      </pre>
                    )}
                    {!showDetail && e.detail && Object.keys(e.detail).length > 0 && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        {Object.keys(e.detail).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {isFinished && (
          <div className="mt-2 rounded-xl bg-green-950/30 border border-green-900/50 p-4 text-center">
            <p className="text-green-300 font-bold text-sm mb-1">✨ All agents finished — reply delivered!</p>
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

const DEMO_PROMPTS = [
  "Explain photosynthesis like I'm 10",
  "Make flashcards for photosynthesis",
  "Quiz me on photosynthesis",
  "Unsa ang photosynthesis? Dili ko kasabot sa English.",
  "I already know photosynthesis makes glucose. Explain the Calvin cycle in depth.",
];

function DemoInner() {
  const searchParams = useSearchParams();
  const requestedRequestId = searchParams?.get("requestId");
  const requestedUserId = searchParams?.get("userId") || DEFAULT_DEMO_USER_ID;
  const [requestId, setRequestId] = useState(
    () => requestedRequestId || `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const demoPrompt = searchParams?.get("prompt") || "";
  const autoSend = searchParams?.get("autoSend") === "1";
  const demoModel = searchParams?.get("model") || "";
  const [modelStatus, setModelStatus] = useState<{ gemma4?: boolean; default?: string }>({});

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setModelStatus({ gemma4: d.gemma4Configured, default: d.defaultModel }))
      .catch(() => setModelStatus({}));
  }, []);

  const resetDemo = () => {
    setRequestId(`demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  };

  return (
    <main className="h-screen flex flex-col bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            P
          </div>
          <div>
            <h1 className="font-bold text-slate-900">PADAYON Demo</h1>
            <p className="text-xs text-slate-500">Chat on the left · Backend agents on the right</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {modelStatus.gemma4 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-600"></span>
              </span>
              Gemma 4 ready
            </span>
          )}
          <button
            onClick={resetDemo}
            className="text-sm rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
          >
            Reset demo
          </button>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Exit demo
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 min-h-0">
        <div className="flex flex-col min-h-0 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex-1 min-h-0">
            <iframe
              key={requestId}
              title="PADAYON Chat"
              src={`/chat?userId=${encodeURIComponent(requestedUserId)}&requestId=${requestId}${demoModel ? `&model=${encodeURIComponent(demoModel)}` : ""}${demoPrompt ? `&prompt=${encodeURIComponent(demoPrompt)}` : ""}${autoSend ? "&autoSend=1" : ""}`}
              className="w-full h-full"
            />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 shrink-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Try these judge prompts
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO_PROMPTS.map((p) => (
                <a
                  key={p}
                  href={`/chat?userId=${encodeURIComponent(requestedUserId)}&requestId=${requestId}&prompt=${encodeURIComponent(p)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-3 py-1.5 border border-slate-200 transition"
                >
                  {p}
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="min-h-0">
          <MonitorPanel requestId={requestId} />
        </div>
      </div>
    </main>
  );
}

export default function Demo() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading demo...</div>}>
      <DemoInner />
    </Suspense>
  );
}
