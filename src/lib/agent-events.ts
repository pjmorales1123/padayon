export interface AgentEvent {
  id: string;
  step:
    | "start"
    | "classify"
    | "curriculum"
    | "subject"
    | "topic"
    | "profile"
    | "retrieve"
    | "research"
    | "mastery"
    | "create_materials"
    | "teach"
    | "memory"
    | "save_reply"
    | "finish"
    | "error";
  label: string;
  status: "running" | "done" | "error";
  detail?: Record<string, unknown>;
  ts: number;
}

export interface AgentRun {
  requestId: string;
  userId: string;
  message: string;
  events: AgentEvent[];
  createdAt: number;
  updatedAt: number;
}

// In-memory store per Node process. Events are ephemeral (demo/observability only).
declare global {
  var __PADAYON_AGENT_EVENTS__: Map<string, AgentRun> | undefined;
}

const store: Map<string, AgentRun> =
  globalThis.__PADAYON_AGENT_EVENTS__ || new Map<string, AgentRun>();
globalThis.__PADAYON_AGENT_EVENTS__ = store;

const listeners: Map<string, Set<(event: AgentEvent, run: AgentRun) => void>> = new Map();

export function getRun(requestId: string): AgentRun | undefined {
  return store.get(requestId);
}

export function getAllRuns(limit = 50): AgentRun[] {
  return Array.from(store.values())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function startRun(requestId: string, userId: string, message: string): AgentRun {
  const run: AgentRun = {
    requestId,
    userId,
    message,
    events: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  store.set(requestId, run);
  return run;
}

export function emitEvent(
  requestId: string,
  event: Omit<AgentEvent, "id" | "ts">
): AgentEvent | null {
  const run = store.get(requestId);
  if (!run) return null;

  const fullEvent: AgentEvent = {
    ...event,
    id: `${requestId}-${run.events.length}`,
    ts: Date.now(),
  };

  run.events.push(fullEvent);
  run.updatedAt = fullEvent.ts;

  const runListeners = listeners.get(requestId);
  if (runListeners) {
    runListeners.forEach((cb) => {
      try {
        cb(fullEvent, run);
      } catch {
        // ignore listener errors
      }
    });
  }

  return fullEvent;
}

export function subscribe(
  requestId: string,
  callback: (event: AgentEvent, run: AgentRun) => void
): () => void {
  if (!listeners.has(requestId)) {
    listeners.set(requestId, new Set());
  }
  listeners.get(requestId)!.add(callback);
  return () => {
    listeners.get(requestId)?.delete(callback);
  };
}

export function logStep(
  requestId: string,
  step: AgentEvent["step"],
  label: string,
  status: AgentEvent["status"] = "running",
  detail?: Record<string, unknown>
): void {
  emitEvent(requestId, { step, label, status, detail });
}
