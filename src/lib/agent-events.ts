import { supabaseAdmin } from "./supabase";

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

// In-memory store per Node process for fast local access.
declare global {
  var __PADAYON_AGENT_EVENTS__: Map<string, AgentRun> | undefined;
}

const store: Map<string, AgentRun> =
  globalThis.__PADAYON_AGENT_EVENTS__ || new Map<string, AgentRun>();
globalThis.__PADAYON_AGENT_EVENTS__ = store;

const listeners: Map<string, Set<(event: AgentEvent, run: AgentRun) => void>> = new Map();

function dbRowToRun(row: {
  request_id: string;
  user_id: string;
  message: string;
  events: AgentEvent[];
  created_at: string;
  updated_at: string;
}): AgentRun {
  return {
    requestId: row.request_id,
    userId: row.user_id,
    message: row.message,
    events: row.events || [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export async function getRun(requestId: string): Promise<AgentRun | undefined> {
  // Fast local hit first.
  const local = store.get(requestId);
  if (local) return local;

  // Fall back to Supabase so polling works across serverless instances.
  try {
    const { data, error } = await supabaseAdmin!
      .from("agent_runs")
      .select("request_id, user_id, message, events, created_at, updated_at")
      .eq("request_id", requestId)
      .single();
    if (error || !data) return undefined;
    const run = dbRowToRun(data as unknown as {
      request_id: string;
      user_id: string;
      message: string;
      events: AgentEvent[];
      created_at: string;
      updated_at: string;
    });
    store.set(requestId, run);
    return run;
  } catch (err) {
    console.warn("Failed to load agent run from Supabase", err);
    return undefined;
  }
}

export async function getAllRuns(limit = 50): Promise<AgentRun[]> {
  try {
    const { data, error } = await supabaseAdmin!
      .from("agent_runs")
      .select("request_id, user_id, message, events, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((row) => dbRowToRun(row as unknown as {
      request_id: string;
      user_id: string;
      message: string;
      events: AgentEvent[];
      created_at: string;
      updated_at: string;
    }));
  } catch (err) {
    console.warn("Failed to load agent runs from Supabase", err);
    return Array.from(store.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }
}

async function persistRun(run: AgentRun): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const { error } = await supabaseAdmin
      .from("agent_runs")
      .upsert(
        {
          request_id: run.requestId,
          user_id: run.userId,
          message: run.message,
          events: run.events as unknown as Record<string, unknown>[],
          created_at: new Date(run.createdAt).toISOString(),
          updated_at: new Date(run.updatedAt).toISOString(),
        },
        { onConflict: "request_id" }
      );
    if (error) console.warn("Failed to persist agent run", error);
  } catch (err) {
    console.warn("Failed to persist agent run", err);
  }
}

export function startRun(requestId: string, userId: string, message: string): AgentRun {
  const existing = store.get(requestId);
  if (existing) return existing;

  const run: AgentRun = {
    requestId,
    userId,
    message,
    events: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  store.set(requestId, run);
  persistRun(run);
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

  persistRun(run);
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
