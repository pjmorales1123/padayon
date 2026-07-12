import { describe, expect, it } from "vitest";
import { isVisualLearningRequest } from "./visual-request";

describe("isVisualLearningRequest", () => {
  it("recognizes students who say they need to see the lesson", () => {
    expect(isVisualLearningRequest("I can't learn using text. I need to see something.")).toBe(true);
  });

  it("does not treat an ordinary explanation request as visual", () => {
    expect(isVisualLearningRequest("Can you explain the types of conflict?")).toBe(false);
  });
});
