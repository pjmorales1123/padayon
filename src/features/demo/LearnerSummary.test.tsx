import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LearnerSummary from "./LearnerSummary";

describe("LearnerSummary", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  function mockSummaryFetch(materialType: string) {
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
                        type: materialType,
                        title: materialType === "pdf_notes" ? "Uploaded PDF" : "Uploaded Image",
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
  }

  it("shows uploaded picture activity in the learner summary", async () => {
    mockSummaryFetch("image_notes");

    render(<LearnerSummary userId="learner-1" refreshKey={0} />);

    expect(
      await screen.findByText("Placed one picture on your library and saved the contents."),
    ).toBeTruthy();
  });

  it("shows uploaded PDF activity in the learner summary", async () => {
    mockSummaryFetch("pdf_notes");

    render(<LearnerSummary userId="learner-1" refreshKey={0} />);

    expect(
      await screen.findByText("Placed one PDF on your library and saved the contents."),
    ).toBeTruthy();
  });

  it("shows visual guide activity in the learner summary", async () => {
    mockSummaryFetch("html_visual");

    render(<LearnerSummary userId="learner-1" refreshKey={0} />);

    expect(
      await screen.findByText(/Created a visual guide for Science/),
    ).toBeTruthy();
  });

  it("shows quiz score and confidence activity in the learner summary", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            user: { name: "Prince Trial 1" },
            profile: {
              language_confidence: { English: "High" },
              learning_style: { visuals: true },
            },
          }),
        )
        .mockResolvedValueOnce(
          Response.json({
            subjects: [
              {
                name: "English",
                topics: [
                  {
                    title: "Types of Conflict",
                    subcategory: "Literature",
                    last_studied_at: "2026-07-11T09:00:00.000Z",
                    progress: {
                      confidence: 60,
                      status: "developing",
                      quiz_attempts: 2,
                      last_score: 80,
                      updated_at: "2026-07-11T09:05:00.000Z",
                    },
                    materials: [{ type: "quiz", title: "Quiz", created_at: "2026-07-11T09:00:00.000Z" }],
                  },
                ],
              },
            ],
          }),
        ),
    );

    render(<LearnerSummary userId="learner-1" refreshKey={0} />);

    expect(await screen.findByText(/80% last score, 2 attempts/)).toBeTruthy();
  });
});
