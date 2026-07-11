import { describe, expect, it } from "vitest";
import {
  getReplyHistoryForIntent,
  getUploadConfirmation,
  getUploadMaterialContent,
  shouldPersistTopicForTurn,
} from "./agent-routing";

describe("agent routing", () => {
  it("keeps a first ordinary topic question out of the visible library", () => {
    expect(
      shouldPersistTopicForTurn({
        intent: "teach_topic",
        topic: "Types of Conflict",
        hasUpload: false,
        history: [],
      })
    ).toBe(false);
  });

  it("promotes an ordinary topic when the student returns to it", () => {
    expect(
      shouldPersistTopicForTurn({
        intent: "teach_topic",
        topic: "Types of Conflict",
        hasUpload: false,
        history: [{ role: "user", content: "What are types of conflict?" }],
      })
    ).toBe(true);
  });

  it("promotes a topic when the classifier uses a close variant of the earlier wording", () => {
    expect(
      shouldPersistTopicForTurn({
        intent: "teach_topic",
        topic: "Poetic Meter",
        hasUpload: false,
        history: [{ role: "user", content: "What is meter in poetry?" }],
      })
    ).toBe(true);
  });

  it("persists uploaded materials immediately", () => {
    expect(
      shouldPersistTopicForTurn({
        intent: "teach_topic",
        topic: "Handwritten Notes",
        hasUpload: true,
        history: [],
      })
    ).toBe(true);
  });

  it("uses an upload confirmation with a generic next action prompt", () => {
    expect(getUploadConfirmation("image", [])).toBe(
      "Placed one picture on your library and saved the contents. What would you like to do with it next?"
    );
    expect(getUploadConfirmation("pdf", [])).toBe(
      "Placed one PDF on your library and saved the contents. What would you like to do with it next?"
    );
  });

  it("offers concrete upload actions from recent study context", () => {
    expect(getUploadConfirmation("image", [{ role: "user", content: "Can you make a quiz for this lesson?" }])).toBe(
      "Placed one picture on your library and saved the contents. Should I include this in your quiz, make flashcards, or create review material from it?"
    );
  });

  it("stores extracted upload text with the uploaded material preview", () => {
    expect(getUploadMaterialContent("pdf", "data:image/png;base64,abc", "OCR text")).toEqual({
      preview_image_url: "data:image/png;base64,abc",
      text: "OCR text",
    });
    expect(getUploadMaterialContent("image", "data:image/png;base64,abc", "OCR text")).toEqual({
      image_url: "data:image/png;base64,abc",
      text: "OCR text",
    });
  });

  it("does not pass prior topic history into fresh teach replies", () => {
    const history = [{ role: "user" as const, content: "Tell me about poems." }];

    expect(getReplyHistoryForIntent("teach_topic", history)).toEqual([]);
    expect(getReplyHistoryForIntent("continue_learning", history)).toEqual(history);
  });
});
