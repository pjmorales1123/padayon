import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgentTrail from "./AgentTrail";

function mockRunResponse(events: unknown[]) {
  return new Response(JSON.stringify({ run: { events } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AgentTrail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the live trail when a request is active", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockRunResponse([
          { id: "e1", step: "start", label: "Received message", status: "done", ts: 1 },
          { id: "e2", step: "classify", label: "Classifier Agent", status: "done", ts: 2 },
          { id: "e3", step: "finish", label: "Response complete", status: "done", ts: 3 },
        ]),
      ),
    );

    render(<AgentTrail requestId="req-1" />);

    await waitFor(() => {
      expect(screen.queryAllByText("Classifier Agent").length).toBeGreaterThan(0);
      expect(screen.getByText(/all agents finished/i)).toBeTruthy();
      expect(screen.getByText("100%")).toBeTruthy();
    });
  });

  it("prompts to send a message when no request is active", () => {
    render(<AgentTrail requestId={null} />);
    expect(screen.getByText(/send a message/i)).toBeTruthy();
  });

  it("keeps one completed agent row and shows its verified model", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockRunResponse([
          { id: "e1", step: "teach", label: "Crafting a student-friendly response", status: "running", ts: 1 },
          {
            id: "e2",
            step: "teach",
            label: "Reply ready",
            status: "done",
            ts: 2,
            detail: { runtime: { provider: "gemma", model: "gemma-4-31b-it", requested: "gemma-4", fallback: false } },
          },
        ]),
      ),
    );

    render(<AgentTrail requestId="req-model" />);

    await waitFor(() => {
      expect(screen.getByText("Completed this turn")).toBeTruthy();
      expect(screen.getByText("Gemma")).toBeTruthy();
      expect(screen.queryByText("Currently working")).toBeNull();
    });
  });

  it("identifies picture processing as the Kimi-powered Vision Agent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockRunResponse([
          {
            id: "e1",
            step: "retrieve",
            label: "Reading text from uploaded picture",
            status: "running",
            ts: 1,
            detail: { runtime: { provider: "fireworks", model: "accounts/fireworks/models/kimi-k2p6", fallback: false } },
          },
        ]),
      ),
    );

    render(<AgentTrail requestId="req-vision" />);

    await waitFor(() => {
      expect(screen.getByText("Vision Agent")).toBeTruthy();
      expect(screen.getByText("AMD Fireworks · Kimi")).toBeTruthy();
    });
  });
});
