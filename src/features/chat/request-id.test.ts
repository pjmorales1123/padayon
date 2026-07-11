import { describe, expect, it } from "vitest";
import { consumeRequestId } from "./request-id";

describe("consumeRequestId", () => {
  it("uses a supplied request id once", () => {
    expect(consumeRequestId("demo-123", () => "req-new")).toBe("demo-123");
  });

  it("generates an id when none is supplied", () => {
    expect(consumeRequestId(undefined, () => "req-new")).toBe("req-new");
  });
});
