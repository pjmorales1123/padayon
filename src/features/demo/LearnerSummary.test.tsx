import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LearnerSummary from "./LearnerSummary";

describe("LearnerSummary", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            user: { name: "Prince Trial 1" },
            profile: {
              language_confidence: { Cebuano: "High" },
              learning_style: { inquiry_based: true },
            },
          }),
        )
        .mockResolvedValueOnce(
          Response.json({
            subjects: [
              {
                name: "Science",
                topics: [
                  {
                    title: "Photosynthesis",
                    subcategory: "Biology",
                    materials: [
                      {
                        type: "image_notes",
                        title: "Uploaded Image",
                        created_at: "2026-07-11T09:00:00.000Z",
                      },
                    ],
                  },
                ],
              },
            ],
          }),
        ),
    );
  });

  it("shows uploaded picture activity in the learner summary", async () => {
    render(<LearnerSummary userId="learner-1" refreshKey={0} />);

    expect(
      await screen.findByText("Placed one picture on your library and saved the contents."),
    ).toBeTruthy();
  });
});
