import { beforeEach, describe, expect, it, vi } from "vitest";
import { callFireworks, type ModelRuntime } from "./fireworks";

const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("callFireworks runtime reporting", () => {
  beforeEach(() => vi.stubEnv("FIREWORKS_API_KEY", "test-key"));

  it("reports the primary serverless model", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok("answer")));
    let runtime: ModelRuntime | undefined;
    expect(await callFireworks([{ role: "user", content: "Hi" }], false, 50, "auto", (value) => { runtime = value; })).toBe("answer");
    expect(runtime).toMatchObject({ requested: "auto", provider: "fireworks", fallback: false });
  });

  it("reports serverless fallback after a primary failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("down", { status: 503 })).mockResolvedValueOnce(ok("backup")));
    let runtime: ModelRuntime | undefined;
    expect(await callFireworks([{ role: "user", content: "Hi" }], false, 50, "auto", (value) => { runtime = value; })).toBe("backup");
    expect(runtime).toMatchObject({ provider: "fireworks", fallback: true });
  });

  it("reports fallback when Gemma fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("down", { status: 503 })).mockResolvedValueOnce(ok("backup")));
    let runtime: ModelRuntime | undefined;
    await callFireworks([{ role: "user", content: "Hi" }], false, 50, "gemma-4", (value) => { runtime = value; });
    expect(runtime).toMatchObject({ requested: "gemma-4", provider: "fireworks", fallback: true });
  });
});
