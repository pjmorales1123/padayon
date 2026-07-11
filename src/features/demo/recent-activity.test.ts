import { describe, expect, it } from "vitest";
import { getRecentActivity } from "./recent-activity";

describe("getRecentActivity", () => {
  it("reports a saved image as learner activity", () => {
    const activity = getRecentActivity([
      {
        topics: [
          {
            title: "Photosynthesis",
            materials: [
              {
                id: "image-1",
                type: "image_notes",
                created_at: "2026-07-11T10:00:00.000Z",
              },
            ],
          },
        ],
      },
    ]);

    expect(activity).toEqual({
      id: "image-1",
      message: "Placed one picture in your library and saved the contents.",
      topicTitle: "Photosynthesis",
    });
  });
});
