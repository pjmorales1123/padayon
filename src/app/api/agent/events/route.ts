import { NextRequest, NextResponse } from "next/server";
import { getRun, subscribe, AgentEvent, AgentRun } from "@/lib/agent-events";

export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get("requestId");
  if (!requestId) {
    return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent, run: AgentRun) => {
        try {
          const payload = JSON.stringify({ event, run });
          controller.enqueue(
            encoder.encode(`event: message\nid: ${event.id}\ndata: ${payload}\n\n`)
          );
        } catch {
          // controller may be closed
        }
      };

      // Replay existing events
      const existingRun = await getRun(requestId);
      if (existingRun) {
        existingRun.events.forEach((event) => send(event, existingRun));
      }

      const unsubscribe = subscribe(requestId, send);

      const close = () => {
        try {
          unsubscribe();
          controller.close();
        } catch {
          // already closed
        }
      };

      // Auto-close once the run finishes or errors
      const checkInterval = setInterval(async () => {
        const run = await getRun(requestId);
        if (run && run.events.length > 0) {
          const last = run.events[run.events.length - 1];
          if (last && (last.step === "finish" || last.status === "error")) {
            clearInterval(checkInterval);
            setTimeout(close, 1500);
          }
        }
      }, 500);

      // Clean up if client disconnects
      if (req.signal) {
        req.signal.addEventListener("abort", () => {
          clearInterval(checkInterval);
          close();
        });
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
