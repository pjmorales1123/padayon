// Keeps explicit student-shared memories compact and safe to display in Profile.
export interface StudentNote {
  id: string;
  text: string;
  created_at: string;
}

const MAX_STUDENT_NOTES = 12;

export function addStudentNote(notes: StudentNote[], text: string, createdAt = new Date().toISOString()): StudentNote[] {
  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 240);
  if (!cleaned || notes.some((note) => note.text.toLowerCase() === cleaned.toLowerCase())) return notes;

  return [...notes, { id: crypto.randomUUID(), text: cleaned, created_at: createdAt }].slice(-MAX_STUDENT_NOTES);
}

export function removeStudentNote(notes: StudentNote[], id: string): StudentNote[] {
  return notes.filter((note) => note.id !== id);
}
