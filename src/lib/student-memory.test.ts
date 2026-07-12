import { describe, expect, it } from "vitest";
import { addStudentNote, removeStudentNote } from "./student-memory";

describe("student memory", () => {
  it("adds one concise explicit note without duplicating it", () => {
    const first = addStudentNote([], "I got a low score in my Math quiz.", "2026-07-12T09:00:00.000Z");
    const second = addStudentNote(first, "I got a low score in my Math quiz.", "2026-07-12T10:00:00.000Z");

    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ text: "I got a low score in my Math quiz.", created_at: "2026-07-12T09:00:00.000Z" });
  });

  it("removes only the selected student note", () => {
    const notes = [
      { id: "first", text: "I want to learn Biology.", created_at: "2026-07-12T09:00:00.000Z" },
      { id: "second", text: "I answered well in class today.", created_at: "2026-07-12T10:00:00.000Z" },
    ];

    expect(removeStudentNote(notes, "first")).toEqual([notes[1]]);
  });
});
