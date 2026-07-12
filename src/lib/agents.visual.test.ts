import { describe, expect, it } from "vitest";
import { visualDesignerAgent } from "./agents";

describe("visualDesignerAgent", () => {
  it("renders an on-screen visual when visual mode is already selected", async () => {
    const visual = await visualDesignerAgent(
      "I can't learn using text. I need to see something.",
      "topic-1",
      "Types of Conflict",
      {
        clean_notes: "Man versus Man is conflict between characters. Man versus Self is an inner struggle.",
        reviewer: "Review the conflict types.",
        flashcards: [{ front: "Man vs. Self", back: "An internal struggle." }],
        quiz: [],
        summary: "Conflict is a struggle in a story.",
      },
      {
        subject: "English",
        subcategory: "Literature",
        topic: "Types of Conflict",
        intent: "make_visual",
        language_detected: "English",
        confidence: 0.9,
      },
      "fallback",
    );

    expect(visual).toMatchObject({ type: "html_visual", topicId: "topic-1" });

    const htmlVisual = visual as { html: string };
    expect(htmlVisual.html).toContain("<!DOCTYPE html>");
    expect(htmlVisual.html).toContain("cdn.tailwindcss.com");
    expect(htmlVisual.html).toContain("DM Sans");
    expect(htmlVisual.html).toContain("grid grid-cols");
    expect(htmlVisual.html).toContain("Character vs. self");
    expect(htmlVisual.html).toContain("Character vs. character");
    expect(htmlVisual.html).toContain("👤⚔️👤");
    expect(htmlVisual.html).toContain("🧠💭");
    expect(htmlVisual.html).toContain("rounded-2xl");
  });
});
