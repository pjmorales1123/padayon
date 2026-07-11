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
      expect(screen.getByText("Response complete")).toBeTruthy();
      expect(screen.getByText("100%")).toBeTruthy();
    });
  });

  it("prompts to send a message when no request is active", () => {
    render(<AgentTrail requestId={null} />);
    expect(screen.getByText(/send a message/i)).toBeTruthy();
  });
});
