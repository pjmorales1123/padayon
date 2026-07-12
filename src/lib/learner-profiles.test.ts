import { describe, expect, it } from "vitest";
import { DEFAULT_LEARNER_PROFILES, mergeLearnerProfiles } from "./learner-profiles";

describe("mergeLearnerProfiles", () => {
  it("keeps every built-in profile and adds locally created students once", () => {
    const profiles = mergeLearnerProfiles([
      { id: "demo-new-student", name: "Duplicate Maria" },
      { id: "user-prince", name: "Prince" },
    ]);

    expect(profiles).toEqual([
      ...DEFAULT_LEARNER_PROFILES,
      { id: "user-prince", name: "Prince" },
    ]);
  });

  it("keeps a selected student visible when their saved profile is unavailable", () => {
    expect(mergeLearnerProfiles([], { id: "user-shared", name: "Shared student" })).toContainEqual({
      id: "user-shared",
      name: "Shared student",
    });
  });
});
