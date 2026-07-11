import { describe, expect, it } from "vitest";
import { buildAppHref } from "./navigation";

describe("buildAppHref", () => {
  it("preserves the selected learner", () => {
    expect(buildAppHref("/library", "demo-bisaya-learner")).toBe(
      "/library?userId=demo-bisaya-learner",
    );
  });

  it("returns a clean route without a learner", () => {
    expect(buildAppHref("/profile")).toBe("/profile");
  });
});
