import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  classifierAgent,
  curriculumAgent,
  researchAgent,
  materialCreatorAgent,
  teachingAgent,
  memoryAgent,
  visualDesignerAgent,
  studentReplyReview,
} from "@/lib/agents";
import { addStudentNote, type StudentNote } from "@/lib/student-memory";
import { ChatMessage, MemoryUpdate, InteractivePayload, StudyPack, Subject, Topic } from "@/lib/types";
import { ModelRuntime } from "@/lib/fireworks";
import { startRun, logStep } from "@/lib/agent-events";
import { isVisualLearningRequest } from "@/lib/visual-request";
import {
  formatRetrievedMaterial,
  getLastLessonReply,
  getReplyHistoryForIntent,
  getUploadMaterialContent,
  isLastLessonQuestion,
  shouldPersistTopicForTurn,
} from "@/lib/agent-routing";

export const maxDuration = 60;

interface MaterialContent {
  text?: string;
  reviewer?: string;
  flashcards?: Array<{ front: string; back: string }>;
  quiz?: Array<{ question: string; choices: string[]; answer: string; explanation?: string }>;
  image_url?: string;
  preview_image_url?: string;
  html?: string;
  title?: string;
}

const RETRIEVAL_INTENTS = [
  "retrieve_material",
  "make_flashcards",
  "make_reviewer",
  "make_quiz",
  "make_summary",
  "make_story",
  "continue_learning",
];

const VALID_INTENTS = new Set([
  "create_study_pack",
  "teach_topic",
  "make_flashcards",
  "make_reviewer",
  "make_quiz",
  "make_summary",
  "make_story",
  "make_visual",
  "retrieve_material",
  "continue_learning",
  "research_topics",
  "unknown",
]);

interface ActiveTopic {
  topicId: string;
  topicTitle: string;
  subcategory: string | null;
  subjectId: string;
  subjectName: string;
}

interface MessageRow {
  role: string;
  content: string;
}

function normalizeTopicKey(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toChatHistory(rows: MessageRow[] | null | undefined): ChatMessage[] {
  return (rows || [])
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

function getRelevantStudentNotes(message: string, notes: StudentNote[] = []): StudentNote[] {
  if (!notes.length) return [];

  const normalizedMessage = message.toLowerCase();
  const keywords = normalizedMessage
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4);

  return notes
    .map((note) => {
      const text = note.text.toLowerCase();
      let score = 0;

      if (/\b(i am|i'm|im)\s+\d{1,2}\b|\b(age|years old|grade|score|goal|want to learn|prefer|struggle|bad day|good day)\b/i.test(text)) {
        score += 2;
      }

      for (const keyword of keywords) {
        if (text.includes(keyword)) score += 2;
      }

      if (/\b(age|years old)\b/i.test(text) && /\b(age|old|year)\b/i.test(normalizedMessage)) score += 3;
      if (/\bscore|quiz|test\b/i.test(text) && /\bscore|quiz|test\b/i.test(normalizedMessage)) score += 3;
      if (/\bgoal|want to learn|learn\b/i.test(text) && /\blearn|goal|want\b/i.test(normalizedMessage)) score += 3;

      return { note, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.note.created_at).getTime() - new Date(a.note.created_at).getTime();
    })
    .slice(0, 4)
    .map((entry) => entry.note);
}

function buildProfileContext(profile: ProfileRow | null, message: string) {
  if (!profile) return null;

  return {
    ...profile,
    relevant_memories: getRelevantStudentNotes(message, profile.student_notes || []).map((note) => note.text),
  };
}

function canonicalizeClassificationToCurriculum(
  classification: { subject: string; subcategory: string; topic: string; intent: string; language_detected: string; confidence: number },
  curriculum: { subject: string; subcategory: string; topic: string; is_competency_aligned: boolean }
) {
  if (!curriculum.is_competency_aligned) return classification;
  return {
    ...classification,
    subject: curriculum.subject || classification.subject,
    subcategory: curriculum.subcategory || classification.subcategory,
    topic: curriculum.topic || classification.topic,
  };
}

function pickExistingTopic(
  topics: Topic[],
  classification: { topic: string; subcategory: string },
  curriculum: { topic: string; subcategory: string; is_competency_aligned: boolean }
) {
  const aliases = new Set([
    normalizeTopicKey(classification.topic),
    normalizeTopicKey(curriculum.is_competency_aligned ? curriculum.topic : ""),
  ]);
  const normalizedSubcategory = normalizeTopicKey(classification.subcategory);

  return topics.find((topic) => {
    const titleKey = normalizeTopicKey(topic.title);
    if (aliases.has(titleKey)) return true;
    const curriculumTopic = normalizeTopicKey(String((topic.curriculum_match as { topic?: string } | null)?.topic || ""));
    if (curriculumTopic && aliases.has(curriculumTopic)) return true;
    return (
      normalizedSubcategory &&
      normalizeTopicKey(topic.subcategory || "") === normalizedSubcategory &&
      (aliases.has(titleKey) || aliases.has(curriculumTopic))
    );
  }) || null;
}

function findRequestedMaterial(
  requestedType: string | null,
  materials: Array<{ type: string; content: MaterialContent; created_at?: string | null }>
) {
  if (!requestedType) return null;
  if (requestedType === "uploaded_notes") {
    return [...materials]
      .filter((material) => material.type === "image_notes" || material.type === "pdf_notes")
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;
  }
  if (requestedType === "html_visual") {
    return [...materials]
      .filter((material) => material.type === "html_visual")
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;
  }
  return materials.find((material) => material.type === requestedType) || null;
}

function buildStudyPackConfirmation(
  classification: { subject: string; subcategory: string; topic: string },
  studyPack: StudyPack,
  topicId: string,
  withAlignmentQuestion = true
): string {
  const lines = [
    `I organized this under:`,
    `**${classification.subject} → ${classification.subcategory} → ${classification.topic}**`,
    "",
    "I created:",
    "✓ Clean Notes",
    "✓ Reviewer",
    "✓ Flashcards",
    "✓ Quiz",
    "✓ Summary",
  ];
  if (studyPack.story) lines.push("✓ Story");
  lines.push("");
  lines.push("I also started your mastery map.");
  if (withAlignmentQuestion) {
    lines.push("");
    lines.push("Does this match what your teacher discussed?");
    lines.push("[Yes] [Partly] [No] [Add more notes]");
  }
  lines.push("");
  lines.push(`Open your study pack: /topic/${topicId}`);
  return lines.join("\n");
}

function buildUploadConfirmation(
  attachmentType: string,
  classification: { subject: string; subcategory: string; topic: string },
  topicId: string
): string {
  const fileLabel = attachmentType === "pdf" ? "PDF" : "image";
  return [
    `Got your ${fileLabel} notes.`,
    "",
    "I saved them in your Library under:",
    `**${classification.subject} -> ${classification.subcategory} -> ${classification.topic}**`,
    "",
    `Saved: uploaded ${fileLabel} + extracted text`,
    "",
    "What would you like to do with it next: summarize it, make flashcards, create a quiz, or clean up the notes?",
    "",
    `Open it in your Library: /topic/${topicId}`,
  ].join("\n");

  /*
  const lines = [
    `Got your ${fileLabel} notes.`,
    "",
    `I saved them in your Library under:`,
    `**${classification.subject} → ${classification.subcategory} → ${classification.topic}**`,
    "",
    "I created:",
    "✓ Clean Notes",
    "✓ Reviewer",
    "✓ Flashcards",
    "✓ Quiz",
    "✓ Summary",
    "",
    "I also started your mastery map.",
  ];
  if (withAlignmentQuestion) {
    lines.push("");
    lines.push("Does this match what your teacher discussed?");
    lines.push("[Yes] [Partly] [No] [Add more notes]");
  }
  return lines.join("\n");
  */
}

function detectTeacherAlignmentResponse(message: string, history: ChatMessage[]): "yes" | "partly" | "no" | null {
  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant || !lastAssistant.content.includes("Does this match what your teacher discussed?")) {
    return null;
  }
  const lower = message.toLowerCase().trim();
  if (/\b(yes|yeah|yep|oo|tama|correct|right|sure|yes,? this is)\b/i.test(lower)) return "yes";
  if (/\b(partly|partial|some|some parts|missing|incomplete)\b/i.test(lower)) return "partly";
  if (/\b(no|nope|dili|hindi|wrong|different)\b/i.test(lower)) return "no";
  return null;
}

async function getLastActiveTopic(userId: string): Promise<ActiveTopic | null> {
  const { data: rows, error } = await supabaseAdmin!
    .from("topics")
    .select("id, title, subcategory, subject_id, subjects(id, name)")
    .eq("subjects.user_id", userId)
    .order("last_studied_at", { ascending: false })
    .limit(1);
  if (error || !rows || rows.length === 0) return null;
  const row = rows[0];
  const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
  if (!subject) return null;
  return {
    topicId: row.id,
    topicTitle: row.title,
    subcategory: row.subcategory,
    subjectId: row.subject_id,
    subjectName: subject.name,
  };
}

function normalizeClassification(
  requestId: string,
  classification: { subject: string; subcategory: string; topic: string; intent: string; language_detected: string; confidence: number },
  lastActive: ActiveTopic | null,
  originalMessage: string
): { subject: string; subcategory: string; topic: string; intent: string; language_detected: string; confidence: number } {
  const lowerIntent = (classification.intent || "").toLowerCase().trim().replace(/\s+/g, "_");
  let intent = VALID_INTENTS.has(lowerIntent) ? lowerIntent : "unknown";

  // Strong visual guard: if the student explicitly asks for a visual/diagram/picture, force make_visual.
  const lowerOriginal = originalMessage.toLowerCase();
  if (isVisualLearningRequest(originalMessage)) {
    intent = "make_visual";
    logStep(requestId, "classify", "Visual request detected, forcing make_visual intent", "done");
  }

  // Strong summary guard: if the student asks for a summary/recap/overview, force make_summary.
  if (/\b(summary|summarize|recap|overview|main points|key points)\b/i.test(lowerOriginal)) {
    intent = "make_summary";
    logStep(requestId, "classify", "Summary request detected, forcing make_summary intent", "done");
  }

  const message = classification.topic || "";
  const isRetrievalLike = RETRIEVAL_INTENTS.includes(intent) || /show my|my flashcards|my quiz|my notes|my reviewer|continue|review this|reviewer/i.test(message);

  let subject = (classification.subject || "").trim();
  let subcategory = (classification.subcategory || "").trim();
  let topic = (classification.topic || "").trim();

  // If the message looks like messy notes / keyword dump but was classified as teach_topic,
  // convert it to create_study_pack so PADAYON organizes and builds materials.
  if (intent === "teach_topic" && !/\?$|^what|^how|^why|^when|^where|^who|explain|describe|mean|difference between|compare|give me|tell me/i.test(message)) {
    const wordCount = message.split(/\s+/).filter((w) => w.length > 2).length;
    const hasAcademicKeywords = /photosynthesis|chlorophyll|cellular|respiration|ecosystem|quadratic|factoring|polynomial|irony|characterization|metaphor|simile|personification|hyperbole|theme|plot|setting/i.test(message);
    const looksLikeNotes = wordCount >= 4 && (message.includes(",") || message.includes("-") || hasAcademicKeywords);
    if (looksLikeNotes) {
      intent = "create_study_pack";
      logStep(requestId, "classify", "Converted keyword dump / notes to create_study_pack", "done");
    }
  }

  // If retrieval/continue intent lacks a clear topic, fall back to the last active topic.
  if (isRetrievalLike && lastActive && (subject === "Unknown" || subject === "" || topic === "Unknown" || topic === "" || topic.length < 2)) {
    subject = lastActive.subjectName;
    subcategory = lastActive.subcategory || subcategory || "General";
    topic = lastActive.topicTitle;
    if (intent === "unknown") intent = "retrieve_material";
    logStep(requestId, "classify", `Fell back to last active topic: ${subject} → ${subcategory} → ${topic}`, "done");
  }

  // Guard against Unknown subject for obvious keyword topics.
  if (subject === "Unknown" || subject === "") {
    const lower = message.toLowerCase();
    if (/photosynthesis|chlorophyll|cellular respiration|ecosystem|biology|cell|organism/.test(lower)) subject = "Science";
    else if (/quadratic|factoring|polynomial|algebra|equation|geometry/.test(lower)) subject = "Math";
    else if (/irony|characterization|point of view|metaphor|simile|theme|plot/.test(lower)) subject = "English";
    else if (/history|government|democracy|economy|culture|revolution|philippines/.test(lower)) subject = "Social Studies";
    else if (/computer|programming|code|html|css|javascript|python|database/.test(lower)) subject = "ICT";
    else if (/music|art|dance|physical education|health|nutrition/.test(lower)) subject = "MAPEH";
    else if (/tula|sanaysay|pandiwa|pang-uri|pang-abay|pilipinas/.test(lower)) subject = "Filipino";
  }

  // Canonicalize topic titles to avoid duplicates like "Photosynthesis" vs "Photosynthesis inputs and outputs".
  // If the message covers multiple distinct concepts, keep them combined rather than collapsing to one.
  const topicLower = topic.toLowerCase();
  const messageLower = message.toLowerCase();
  const englishTopics: string[] = [];
  if (messageLower.includes("point of view")) englishTopics.push("Point of View");
  if (messageLower.includes("irony")) englishTopics.push("Irony");
  if (messageLower.includes("characterization")) englishTopics.push("Characterization");
  if (messageLower.includes("metaphor") || messageLower.includes("simile") || messageLower.includes("personification") || messageLower.includes("hyperbole") || messageLower.includes("figurative")) englishTopics.push("Figures of Speech");
  if (messageLower.includes("theme")) englishTopics.push("Theme");
  if (messageLower.includes("plot")) englishTopics.push("Plot");
  if (messageLower.includes("setting")) englishTopics.push("Setting");

  if (englishTopics.length > 1) {
    topic = englishTopics.join(" and ");
  } else if (topicLower.includes("photosynthesis")) topic = "Photosynthesis";
  else if (topicLower.includes("cellular respiration")) topic = "Cellular Respiration";
  else if (topicLower.includes("ecosystem")) topic = "Ecosystem";
  else if (topicLower.includes("quadratic formula")) topic = "Quadratic Formula";
  else if (topicLower.includes("quadratic")) topic = "Quadratic Equations";
  else if (topicLower.includes("factoring")) topic = "Factoring";
  else if (topicLower.includes("irony")) topic = "Irony";
  else if (topicLower.includes("characterization")) topic = "Characterization";
  else if (topicLower.includes("point of view")) topic = "Point of View";
  else if (topicLower.includes("metaphor") || topicLower.includes("simile") || topicLower.includes("personification") || topicLower.includes("hyperbole") || topicLower.includes("figurative")) topic = "Figures of Speech";

  // Ensure subcategory is never empty.
  if (!subcategory) subcategory = "General";

  // Force English if the message has no Filipino/Cebuano words.
  let languageDetected = (classification.language_detected || "English").trim();
  const hasLocalWord = /(ang|ng|sa|mga|ako|ikaw|siya|ito|iyan|iyon|kami|kayo|sila|tayo|kung|dahil|pero|kasi|hindi|wala|oo|opo|oo nga|sige|salamat|daghang|kay|ug|kini|niya|ila|imo|akoang|imong|iyang|amoa|inyo|atong|ilaang|nako|nimo|niya|nato|ninyo|nila|para|dito|doon|saan|kailan|bakit|paano|sino|ano|unsa|asa|kanus-a|ngano|giunsa|kinsa)/i.test(originalMessage);
  if (!hasLocalWord && languageDetected !== "English") {
    languageDetected = "English";
    logStep(requestId, "classify", "No local language words found; forcing English", "done");
  }

  return {
    subject,
    subcategory,
    topic,
    intent,
    language_detected: languageDetected,
    confidence: typeof classification.confidence === "number" ? classification.confidence : 0.7,
  };
}

function computeMasteryUpdate(
  current: Record<string, unknown> | null,
  intent: string,
  quizResult: { correct: boolean; topic: string; question?: string } | null,
  message: string
): Record<string, unknown> {
  const p = current || {};
  let confidence = typeof p.confidence === "number" ? p.confidence : 0;
  let attempts = typeof p.attempts === "number" ? p.attempts : 0;
  let correctCount = typeof p.correct === "number" ? p.correct : 0;
  let incorrectCount = typeof p.incorrect === "number" ? p.incorrect : 0;
  let interactions = typeof p.interactions === "number" ? p.interactions : 0;

  // Count a student correction about their own understanding as a learning interaction.
  if (/not good at|not confident|don't understand|hindi ako magaling|hindi ko gets|dili ko kasabot|weak in|struggle with/i.test(message)) {
    interactions++;
  }

  interactions++;

  if (quizResult) {
    attempts++;
    if (quizResult.correct) {
      correctCount++;
      confidence = Math.min(100, confidence + 20);
    } else {
      incorrectCount++;
      confidence = Math.max(0, confidence - 10);
    }
  } else if (intent === "teach_topic") {
    const positive = /got it|understand|cool|thanks|ah okay|masabtan|naintindihan|i see|makes sense|that's right|yes/i.test(message);
    const negative = /don't get|confused|hard|dumb|wala ko kasabot|hindi ko gets|i don't understand|i'm lost/i.test(message);
    if (positive) confidence = Math.min(100, confidence + 10);
    if (negative) confidence = Math.max(0, confidence - 5);
  } else if (["make_quiz", "make_flashcards", "retrieve_material", "continue_learning"].includes(intent)) {
    confidence = Math.min(100, confidence + 5);
  }

  const status = confidence >= 80 ? "mastered" : confidence >= 40 ? "developing" : "started";
  return {
    confidence,
    attempts,
    correct: correctCount,
    incorrect: incorrectCount,
    interactions,
    status,
    last_studied_at: new Date().toISOString(),
  };
}

function mapIntentToType(intent: string, message: string): string | null {
  if (intent === "make_flashcards") return "flashcards";
  if (intent === "make_quiz") return "quiz";
  if (intent === "make_reviewer") return "reviewer";
  if (intent === "make_summary") return "summary";
  if (intent === "make_story") return "story";
  if (intent === "make_visual") return "html_visual";
  if (intent === "retrieve_material") {
    const lower = message.toLowerCase();
    if (/(recent|latest|last).*(visual|diagram|infographic|chart)|show.*(visual|diagram|infographic|chart)|my visual/i.test(lower)) return "html_visual";
    if (/(uploaded|upload|sent).*(notes|image|picture|photo|pdf)|my uploads?|show.*(upload|picture|photo|pdf)/i.test(lower)) {
      if (lower.includes("pdf")) return "pdf_notes";
      if (lower.includes("image") || lower.includes("picture") || lower.includes("photo")) return "image_notes";
      return "uploaded_notes";
    }
    if (lower.includes("flashcard")) return "flashcards";
    if (lower.includes("quiz")) return "quiz";
    if (lower.includes("reviewer") || lower.includes("review")) return "reviewer";
    if (lower.includes("story") || lower.includes("kwento") || lower.includes("sugilanon")) return "story";
    if (lower.includes("clean notes")) return "clean_notes";
    if (lower.includes("summary")) return "summary";
    return null; // generic "look" should not default to flashcards
  }
  return null;
}

function buildRetrievalInteractive(
  requestedType: string | null,
  topicId: string,
  topicTitle: string,
  materials: Array<{ type: string; content: MaterialContent; created_at?: string | null }>
): InteractivePayload | null {
  const type = requestedType;
  if (!type) return null;

  if (type === "html_visual") {
    const found = findRequestedMaterial(type, materials);
    const html = found?.content?.html;
    if (html) {
      return { type: "html_visual", topic: topicTitle, topicId, title: found.content.title || `${topicTitle} Visual`, html };
    }
  }

  if (type === "flashcards") {
    const found = materials.find((m) => m.type === "flashcards");
    const cards = found?.content?.flashcards;
    if (cards && cards.length > 0) {
      return { type: "flashcards", topic: topicTitle, topicId, cards };
    }
  }

  if (type === "quiz") {
    const found = materials.find((m) => m.type === "quiz");
    const questions = found?.content?.quiz;
    if (questions && questions.length > 0) {
      const normalized = questions.map((q) => ({
        question: q.question,
        choices: q.choices,
        answer: q.answer,
        explanation: q.explanation || "",
      }));
      return { type: "quiz", topic: topicTitle, topicId, questions: normalized };
    }
  }

  if (type === "reviewer" || type === "summary") {
    const found = materials.find((m) => m.type === type);
    const text = found?.content?.text;
    if (text) {
      const cards = text
        .split("\n")
        .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
        .filter((line) => line.length > 10)
        .slice(0, 4)
        .map((line) => ({ icon: "📝", title: "Key point", body: line }));
      if (cards.length > 0) {
        return { type: "info_cards", topic: topicTitle, topicId, cards };
      }
    }
  }

  if (type === "story") {
    const found = materials.find((m) => m.type === "story");
    const text = found?.content?.text;
    if (text) {
      return { type: "info_cards", topic: topicTitle, topicId, cards: [{ icon: "📖", title: "Story", body: text }] };
    }
  }

  if (type === "image_notes" || type === "pdf_notes" || type === "uploaded_notes") {
    const found = findRequestedMaterial(type, materials);
    const text = found?.content?.text;
    if (text) {
      return {
        type: "info_cards",
        topic: topicTitle,
        topicId,
        cards: text
          .split("\n")
          .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
          .filter((line) => line.length > 4)
          .slice(0, 4)
          .map((line) => ({ icon: found?.type === "pdf_notes" ? "📄" : "📷", title: "Uploaded note", body: line })),
      };
    }
  }

  return null;
}

interface ProfileRow extends Record<string, unknown> {
  id?: string;
  language_confidence?: Record<string, string>;
  learning_style?: Record<string, unknown>;
  strengths?: string[];
  weaknesses?: string[];
  student_notes?: StudentNote[];
}

async function applyMemoryUpdate(
  requestId: string,
  userId: string,
  message: string,
  quizResult: { correct: boolean; topic: string; question?: string } | undefined,
  classification: { topic: string; language_detected: string; intent?: string },
  existingProfile: ProfileRow | null,
  model: import("@/lib/fireworks").ModelPreference = "auto"
) {
  try {
    logStep(requestId, "memory", "Updating learner profile from this interaction", "running");
    const memoryQuizResult = quizResult
      ? { ...quizResult, topic: classification.topic }
      : null;

    const memoryUpdate: MemoryUpdate = await memoryAgent(
      message,
      memoryQuizResult,
      existingProfile || {},
      model
    );

    const lsUpdate = memoryUpdate.learning_style_update || "";
    const normalizeStyle = (s: string) =>
      s
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const lsEntries = lsUpdate
      .split(",")
      .map((s) => normalizeStyle(s))
      .filter((s) => s.length > 0 && !/no change|none|n\/a/i.test(s))
      .map((s) => [s, true]);
    if (classification.intent === "make_visual" || isVisualLearningRequest(message)) {
      lsEntries.push(["visuals", true], ["visual examples", true]);
    }

    const newStrength = (memoryUpdate.strength_update || "").trim();
    const newWeakness = (memoryUpdate.weakness_update || "").trim();
    const studentNotes = addStudentNote(existingProfile?.student_notes || [], memoryUpdate.student_note || "");

    // Parse explicit language confidence updates like "English: Low" or "Filipino: High".
    const langUpdateMatch = (memoryUpdate.language_confidence_update || "").match(/([^:]+):\s*(Low|Medium|High|Developing)/i);
    const languageUpdate: Record<string, string> = {};
    if (langUpdateMatch) {
      languageUpdate[langUpdateMatch[1].trim()] = langUpdateMatch[2].trim();
    }

    const profileUpdate = {
      language_confidence: {
        ...(existingProfile?.language_confidence || {}),
        ...(Object.keys(languageUpdate).length > 0
          ? languageUpdate
          : { [classification.language_detected]: "High" }),
      },
      learning_style: {
        ...(existingProfile?.learning_style || {}),
        ...Object.fromEntries(lsEntries),
      },
      strengths: [
        ...new Set([
          ...(existingProfile?.strengths || []),
          ...(newStrength && !/no change|none|n\/a/i.test(newStrength) ? [newStrength] : []),
        ]),
      ],
      weaknesses: [
        ...new Set([
          ...(existingProfile?.weaknesses || []),
          ...(newWeakness && !/no change|none|n\/a/i.test(newWeakness) ? [newWeakness] : []),
        ]),
      ],
      student_notes: studentNotes,
      updated_at: new Date().toISOString(),
    };

    if (existingProfile) {
      await supabaseAdmin!
        .from("learner_profiles")
        .update(profileUpdate)
        .eq("id", existingProfile.id);
    } else {
      await supabaseAdmin!.from("learner_profiles").insert({
        user_id: userId,
        language_confidence: profileUpdate.language_confidence,
        learning_style: profileUpdate.learning_style,
        strengths: profileUpdate.strengths,
        weaknesses: profileUpdate.weaknesses,
        student_notes: profileUpdate.student_notes,
      });
    }
    logStep(requestId, "memory", "Learner profile updated", "done", { updatedFields: Object.keys(profileUpdate) });
  } catch (err) {
    logStep(requestId, "memory", "Learner profile update failed", "error", { error: String(err) });
    console.error("Memory update error:", err);
  }
}

export async function POST(req: NextRequest) {
  let modelRuntime: ModelRuntime | null = null;
  let requestId = "";

  try {
    const body = await req.json();
    const { userId, message, displayMessage, quizResult, requestId: clientRequestId, imageUrl, attachmentType, model, topicId: providedTopicId } = body;
    const preferredModel =
      model === "gemma-3" || model === "gemma-4" || model === "fallback"
        ? model
        : "auto";

    if (!userId || !message) {
      return NextResponse.json({ error: "Missing userId or message", model_runtime: modelRuntime }, { status: 400 });
    }
    const savedUserMessage =
      imageUrl && typeof displayMessage === "string" && displayMessage.trim()
        ? displayMessage.trim()
        : message;

    requestId = clientRequestId || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    startRun(requestId, userId, message);
    logStep(requestId, "start", "Received student message", "done", { messageLength: message.length });

    // Load explicitly provided topic (from the client) so follow-ups stay in context.
    let providedTopic: Topic | null = null;
    let providedSubject: Subject | null = null;
    if (providedTopicId) {
      const { data: pt } = await supabaseAdmin!
        .from("topics")
        .select("*")
        .eq("id", providedTopicId)
        .maybeSingle();
      if (pt) {
        providedTopic = pt as Topic;
        const { data: ps } = await supabaseAdmin!
          .from("subjects")
          .select("id, name")
          .eq("id", pt.subject_id)
          .maybeSingle();
        providedSubject = (ps as Subject) || null;
        logStep(requestId, "profile", `Client provided topic: ${providedSubject?.name || "unknown"} → ${pt.title}`, "done", { topicId: pt.id });
      }
    }

    // 1. Load recent conversation history for this user (across all topics)
    logStep(requestId, "profile", "Loading conversation history", "running");
    const { data: historyRows, error: historyErr } = await supabaseAdmin!
      .from("messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (historyErr) console.error("History load error:", historyErr);

    const history = toChatHistory((historyRows || []) as MessageRow[]);

    logStep(requestId, "profile", "Loaded conversation history", "done", { historyMessages: history.length });

    // 2. Load last active topic for retrieval fallback
    logStep(requestId, "profile", "Loading last active topic for retrieval fallback", "running");
    const lastActiveTopic = await getLastActiveTopic(userId);
    logStep(requestId, "profile", "Last active topic loaded", "done", { lastActive: lastActiveTopic ? `${lastActiveTopic.subjectName} → ${lastActiveTopic.topicTitle}` : "none" });

    // 3. Classifier Agent with history context
    logStep(requestId, "classify", "Classifier Agent: detecting subject, topic & intent", "running");
    let classification = await classifierAgent(message, history, preferredModel);
    classification = normalizeClassification(requestId, classification, lastActiveTopic, message);

    // If the client sent an explicit topicId, lock the conversation to that topic.
    if (providedTopic && providedSubject) {
      classification = {
        ...classification,
        subject: providedSubject.name,
        subcategory: (providedTopic.subcategory as string) || classification.subcategory,
        topic: (providedTopic.title as string) || classification.topic,
      };
      logStep(requestId, "classify", `Locked to provided topic: ${classification.subject} → ${classification.subcategory} → ${classification.topic}`, "done", { classification });
    }

    // If this message is a quiz follow-up, keep the quiz topic so feedback stays in context.
    if (quizResult?.topic) {
      const { data: quizTopic } = await supabaseAdmin!
        .from("topics")
        .select("id, title, subject_id, subcategory")
        .eq("title", quizResult.topic)
        .maybeSingle();
      const { data: quizSubject } = quizTopic
        ? await supabaseAdmin!.from("subjects").select("name").eq("id", quizTopic.subject_id).maybeSingle()
        : { data: null };
      classification = {
        ...classification,
        topic: quizTopic?.title || quizResult.topic,
        subcategory: quizTopic?.subcategory || classification.subcategory,
        subject: quizSubject?.name || classification.subject,
        intent: "teach_topic",
      };
      logStep(requestId, "classify", `Quiz context kept: ${classification.subject} → ${classification.subcategory} → ${classification.topic}`, "done", { classification });
    } else {
      logStep(requestId, "classify", `Detected: ${classification.subject} → ${classification.subcategory} → ${classification.topic}`, "done", { classification });
    }

    // 3. Research / topic recovery path
    if (classification.intent === "research_topics") {
      if (lastActiveTopic && isLastLessonQuestion(message)) {
        const reply = getLastLessonReply(lastActiveTopic);
        const activeTopic = {
          id: lastActiveTopic.topicId,
          title: lastActiveTopic.topicTitle,
          subject_id: lastActiveTopic.subjectId,
          subcategory: lastActiveTopic.subcategory,
        };

        await supabaseAdmin!.from("messages").insert([
          { user_id: userId, topic_id: lastActiveTopic.topicId, role: "user", content: message },
          { user_id: userId, topic_id: lastActiveTopic.topicId, role: "assistant", content: reply },
        ]);
        logStep(requestId, "research", `Returned last lesson: ${lastActiveTopic.topicTitle}`, "done");
        logStep(requestId, "finish", "Response complete", "done");
        return NextResponse.json({ requestId, reply, classification, curriculum: null, topic: activeTopic, materials_created: [], saved_materials: [], interactive: null, memory_update: null, model_runtime: modelRuntime });
      }

      logStep(requestId, "research", "Research Agent: finding related topics", "running");

      let curriculumQuery = supabaseAdmin!.from("curriculum_items").select("subject,topic,competency").limit(20);
      if (classification.subject && classification.subject !== "Unknown") {
        curriculumQuery = curriculumQuery.ilike("subject", classification.subject);
      }
      const { data: curriculumItems } = await curriculumQuery;

      const { data: profileRow } = await supabaseAdmin!
        .from("learner_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      const reply = await researchAgent(
        message,
        classification,
        (curriculumItems || []) as Array<{ subject: string; topic: string; competency: string }>,
        (profileRow as Record<string, unknown>) || {},
        preferredModel
      );

      await supabaseAdmin!.from("messages").insert({
        user_id: userId,
        topic_id: null,
        role: "assistant",
        content: reply,
      });

      logStep(requestId, "research", "Suggested related topics", "done", { topics: curriculumItems?.length || 0 });
      logStep(requestId, "finish", "Response complete", "done");
      return NextResponse.json({ requestId, reply, classification, curriculum: null, topic: null, materials_created: [], saved_materials: [], interactive: null, memory_update: null, model_runtime: modelRuntime });
    }

    // 4. Curriculum Alignment Agent
    logStep(requestId, "curriculum", "Curriculum Agent: aligning to Grade 9 competencies", "running");
    const curriculum = await curriculumAgent(classification, preferredModel);
    logStep(requestId, "curriculum", `Aligned to ${curriculum.grade_level} competency`, "done", { curriculum });
    classification = canonicalizeClassificationToCurriculum(classification, curriculum);

    const hasUpload = Boolean(imageUrl);
    const shouldPersistTopic =
      Boolean(quizResult?.topic) ||
      shouldPersistTopicForTurn({
        intent: classification.intent,
        topic: classification.topic,
        hasUpload,
        isCompetencyAligned: curriculum.is_competency_aligned,
        history,
      });

    if (!shouldPersistTopic) {
      logStep(requestId, "topic", "Kept first topic mention as hidden candidate", "done", {
        topic: classification.topic,
        intent: classification.intent,
      });

      await supabaseAdmin!.from("messages").insert({
        user_id: userId,
        topic_id: null,
        role: "user",
        content: savedUserMessage,
      });

      logStep(requestId, "profile", "Loading full learner profile", "running");
      const { data: p } = await supabaseAdmin!
        .from("learner_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      const profileRow = (p as ProfileRow | null) || null;
      logStep(requestId, "profile", "Learner profile loaded", "done", { hasProfile: !!profileRow });

      const teachingQuizResult = quizResult
        ? { ...quizResult, topic: classification.topic }
        : null;

      logStep(requestId, "teach", "Teaching Agent: crafting personalized reply", "running");
      const reply = await teachingAgent(
        message,
        classification.topic,
        curriculum,
        buildProfileContext(profileRow, message) || {},
        providedTopic ? history : getReplyHistoryForIntent(classification.intent, history),
        undefined,
        teachingQuizResult,
        classification,
        preferredModel,
        (runtime) => { modelRuntime = runtime; },
        imageUrl
      );
      const finalReply = reply && reply.length >= 10
        ? reply
        : `Let's learn about ${classification.topic} step by step.\n\n${curriculum.competency}\n\nCan you tell me what you already know about it?`;
      logStep(requestId, "teach", "Reply ready", "done", { replyLength: finalReply.length, runtime: modelRuntime });

      logStep(requestId, "save_reply", "Saving reply to conversation history", "running");
      await supabaseAdmin!.from("messages").insert({
        user_id: userId,
        topic_id: null,
        role: "assistant",
        content: finalReply,
      });
      logStep(requestId, "save_reply", "Reply saved", "done");
      logStep(requestId, "finish", "Response complete", "done", { candidate_topic: classification.topic });

      return NextResponse.json({
        requestId,
        reply: finalReply,
        classification,
        curriculum,
        topic: null,
        materials_created: [],
        saved_materials: [],
        interactive: null,
        memory_update: null,
        model_runtime: modelRuntime,
      });
    }

    // 4. Find or create subject (case-insensitive to avoid duplicates)
    let subject: Subject | null = null;
    if (providedSubject) {
      subject = providedSubject;
      logStep(requestId, "subject", `Using client-provided subject: ${subject.name}`, "done", { subjectId: subject.id });
    } else {
      logStep(requestId, "subject", `Finding or creating subject: ${classification.subject}`, "running");
      const { data: subjects } = await supabaseAdmin!
        .from("subjects")
        .select("*")
        .eq("user_id", userId)
        .ilike("name", classification.subject)
        .limit(1);
      subject = subjects?.[0] || null;

      if (!subject) {
        const { data: newSubject, error: subjErr } = await supabaseAdmin!
          .from("subjects")
          .insert({ user_id: userId, name: classification.subject })
          .select()
          .single();
        if (subjErr) throw subjErr;
        subject = newSubject;
      }
    }
    if (!subject) throw new Error("Subject could not be resolved");
    logStep(requestId, "subject", `Subject ready: ${subject.name}`, "done", { subjectId: subject.id });

    // 5. Find or create topic (case-insensitive to avoid duplicates)
    let topic: Topic | null = null;
    if (providedTopic) {
      topic = providedTopic;
      await supabaseAdmin!
        .from("topics")
        .update({ last_studied_at: new Date().toISOString() })
        .eq("id", topic.id as string);
      logStep(requestId, "topic", `Using client-provided topic: ${topic.title}`, "done", { topicId: topic.id });
    } else {
      logStep(requestId, "topic", `Finding or creating topic: ${classification.topic}`, "running");
      const { data: topics } = await supabaseAdmin!
        .from("topics")
        .select("*")
        .eq("subject_id", subject.id)
        .order("last_studied_at", { ascending: false });
      topic = pickExistingTopic((topics || []) as Topic[], classification, curriculum);

      if (!topic) {
        const { data: newTopic, error: topicErr } = await supabaseAdmin!
          .from("topics")
          .insert({
            subject_id: subject.id,
            title: curriculum.is_competency_aligned ? curriculum.topic : classification.topic,
            subcategory: curriculum.is_competency_aligned ? curriculum.subcategory : classification.subcategory,
            curriculum_match: curriculum,
            last_studied_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (topicErr) throw topicErr;
        topic = newTopic as Topic;
      } else {
        await supabaseAdmin!
          .from("topics")
          .update({ last_studied_at: new Date().toISOString() })
          .eq("id", topic.id);
      }
    }
    logStep(requestId, "topic", `Topic ready: ${topic.title}`, "done", { topicId: topic.id });

    // Teacher-alignment confirmation handling.
    const alignmentResponse = detectTeacherAlignmentResponse(message, history);
    if (alignmentResponse && topic) {
      let alignmentReply = "";
      if (alignmentResponse === "yes") {
        await supabaseAdmin!
          .from("topics")
          .update({ teacher_confirmed: true, last_studied_at: new Date().toISOString() })
          .eq("id", topic.id);
        alignmentReply = `Great. I’ll treat this as your confirmed class lesson.\n\nI’ll keep future explanations, quizzes, and reviewers focused on this lesson unless you ask for an advanced explanation.`;
      } else if (alignmentResponse === "partly") {
        alignmentReply = `Thanks for letting me know. What’s missing from your class lesson? Send me the missing notes or topics and I’ll update your study pack.`;
      } else if (alignmentResponse === "no") {
        alignmentReply = `Thanks for the correction. What topic did your teacher actually discuss? Send me the lesson title or notes and I’ll rebuild your study pack.`;
      }

      await supabaseAdmin!.from("messages").insert({ user_id: userId, topic_id: topic.id, role: "user", content: message });
      await supabaseAdmin!.from("messages").insert({ user_id: userId, topic_id: topic.id, role: "assistant", content: alignmentReply });
      logStep(requestId, "save_reply", "Teacher-alignment reply saved", "done");
      logStep(requestId, "finish", "Response complete", "done");
      return NextResponse.json({ requestId, reply: alignmentReply, classification, curriculum, topic, materials_created: [], saved_materials: [], interactive: null, memory_update: null, model_runtime: modelRuntime });
    }

    // 6. Save original notes
    await supabaseAdmin!.from("messages").insert({
      user_id: userId,
      topic_id: topic.id,
      role: "user",
      content: savedUserMessage,
    });

    // 7. Retrieve existing materials if retrieval or visual intent
    let reply = "";
    let materials_created: string[] = [];
    let savedMaterials: Array<{ type: string; id: string }> = [];
    let studyPack = null;
    let interactive: InteractivePayload | null = null;

    const isRetrieval = RETRIEVAL_INTENTS.includes(classification.intent);
    const isVisualRequest = classification.intent === "make_visual";
    const isUploadOnly = Boolean(imageUrl);
    let replyHistory = getReplyHistoryForIntent(classification.intent, history);

    if (classification.intent === "teach_topic" && topic?.id) {
      const { data: topicHistoryRows } = await supabaseAdmin!
        .from("messages")
        .select("role, content")
        .eq("user_id", userId)
        .eq("topic_id", topic.id)
        .order("created_at", { ascending: false })
        .limit(10);
      replyHistory = toChatHistory((topicHistoryRows || []) as MessageRow[]);
      logStep(requestId, "profile", "Loaded current topic history", "done", { historyMessages: replyHistory.length });
    }

    async function loadMaterialsForTopic(topicId: string) {
      const { data } = await supabaseAdmin!
        .from("materials")
        .select("*")
        .eq("topic_id", topicId)
        .order("created_at", { ascending: false });
      return data || [];
    }

    function buildStudyPackFromMaterials(materials: Array<{ type: string; content: MaterialContent }>): StudyPack | null {
      const cleanNotes = materials.find((m) => m.type === "clean_notes")?.content?.text || "";
      const reviewer = materials.find((m) => m.type === "reviewer")?.content?.text || "";
      const summary = materials.find((m) => m.type === "summary")?.content?.text || "";
      const story = materials.find((m) => m.type === "story")?.content?.text || "";
      const flashcards = materials.find((m) => m.type === "flashcards")?.content?.flashcards || [];
      const quizRaw = materials.find((m) => m.type === "quiz")?.content?.quiz || [];
      const quiz = quizRaw.map((q) => ({
        question: q.question || "",
        choices: q.choices || [],
        answer: q.answer || "",
        explanation: q.explanation || "",
      }));
      if (!cleanNotes && !summary && flashcards.length === 0 && quiz.length === 0) return null;
      return { clean_notes: cleanNotes, reviewer, summary, story, flashcards, quiz };
    }

    if (isRetrieval || isVisualRequest) {
      logStep(requestId, "retrieve", `Retrieving saved materials for ${classification.topic}`, "running");
      const materials = await loadMaterialsForTopic(topic.id);

      if (isVisualRequest) {
        const existingStudyPack = buildStudyPackFromMaterials(materials);
        if (existingStudyPack) {
          studyPack = existingStudyPack;
          logStep(requestId, "retrieve", "Loaded existing study pack for visual generation", "done");
        } else {
          logStep(requestId, "retrieve", "No existing study pack — will create materials first", "done");
        }
      }

      const requestedType = mapIntentToType(classification.intent, message);

      if (requestedType) {
        const found = findRequestedMaterial(
          requestedType,
          (materials || []) as Array<{ type: string; content: MaterialContent; created_at?: string | null }>
        );
        if (found) {
          const label =
            requestedType === "html_visual"
              ? "visual"
              : requestedType === "uploaded_notes"
                ? "uploaded notes"
                : requestedType.replace(/_/g, " ");
          reply = `Here ${requestedType === "html_visual" ? "is" : "are"} your saved ${label} for ${classification.topic} from ${classification.subject} → ${classification.subcategory}.`;
          reply += formatRetrievedMaterial(found.type, found.content);
          interactive = buildRetrievalInteractive(
            requestedType,
            topic.id,
            topic.title,
            (materials || []) as Array<{ type: string; content: MaterialContent; created_at?: string | null }>
          );
          logStep(requestId, "retrieve", `Returned saved ${requestedType}`, "done", { type: requestedType });
        } else {
          reply = `I don't have ${requestedType} for ${classification.topic} yet. Let me create them!`;
          logStep(requestId, "retrieve", `${requestedType} not found — will create`, "done", { type: requestedType });
        }
      } else if (classification.intent === "continue_learning" && materials) {
        const summary = materials.find((m) => m.type === "summary");
        const flashcards = materials.find((m) => m.type === "flashcards");
        const quiz = materials.find((m) => m.type === "quiz");
        const story = materials.find((m) => m.type === "story");
        if (summary || flashcards || quiz || story) {
          reply = `Welcome back to ${classification.topic}! Let's keep learning.`;
          if (summary?.content?.text) {
            reply += `\n\nQuick summary:\n${summary.content.text}`;
          }
          if (story?.content?.text) {
            reply += `\n\nStory:\n${story.content.text}`;
          }
          reply += `\n\nYou can:`;
          if (flashcards) reply += `\n- Review your flashcards`;
          if (quiz) reply += `\n- Take the quiz`;
          if (story) reply += `\n- Read the story again`;
          reply += `\n\nOpen your study pack here: /topic/${topic.id}`;
        } else {
          reply = `Let's start learning about ${classification.topic}!`;
        }
        logStep(requestId, "retrieve", "Compiled continue-learning overview", "done");
      }
    }

    const shouldCreateMaterials =
      !isUploadOnly &&
      (classification.intent === "create_study_pack" ||
        (isVisualRequest && !studyPack) ||
        reply.includes("Let me create them"));

    // Visual requests: if we already have materials, reply quickly and let the HTML widget do the teaching.
    if (isVisualRequest && studyPack && !reply) {
      reply = `Here's an interactive visual for **${classification.topic}**. Tap the cards to flip them!`;
    }

    const shouldTeach = !reply && !shouldCreateMaterials && !isUploadOnly;

    let profileRow: Record<string, unknown> | null = null;

    if (shouldCreateMaterials || shouldTeach) {
      logStep(requestId, "profile", "Loading full learner profile", "running");
      const { data: p } = await supabaseAdmin!
        .from("learner_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      profileRow = (p as ProfileRow | null) || null;
      logStep(requestId, "profile", "Learner profile loaded", "done", { hasProfile: !!profileRow });
    }

    if (shouldCreateMaterials) {
      logStep(requestId, "create_materials", "Material Creator Agent: building study pack", "running");
      studyPack = await materialCreatorAgent(message, classification.topic, curriculum, profileRow || {}, preferredModel);

      const materialInserts = [
        { topic_id: topic.id, type: "original_notes", title: "Original Notes", content: { text: message } },
        { topic_id: topic.id, type: "clean_notes", title: "Clean Notes", content: { text: studyPack.clean_notes } },
        { topic_id: topic.id, type: "reviewer", title: "Reviewer", content: { text: studyPack.reviewer } },
        { topic_id: topic.id, type: "flashcards", title: "Flashcards", content: { flashcards: studyPack.flashcards } },
        { topic_id: topic.id, type: "quiz", title: "Quiz", content: { quiz: studyPack.quiz } },
        { topic_id: topic.id, type: "summary", title: "Summary", content: { text: studyPack.summary } },
        ...(studyPack.story ? [{ topic_id: topic.id, type: "story", title: "Story", content: { text: studyPack.story } }] : []),
      ];

      const { data: existingMaterials } = await supabaseAdmin!
        .from("materials")
        .select("id, type")
        .eq("topic_id", topic.id);

      const existingByType = new Map((existingMaterials || []).map((m) => [m.type, m.id]));

      for (const m of materialInserts) {
        const existingId = existingByType.get(m.type);
        if (existingId) {
          const { error } = await supabaseAdmin!
            .from("materials")
            .update({ content: m.content })
            .eq("id", existingId);
          if (error) console.error("Material update error:", error);
        } else {
          const { data: inserted, error } = await supabaseAdmin!
            .from("materials")
            .insert(m as unknown as Record<string, unknown>)
            .select("id, type")
            .single();
          if (error) {
            console.error("Material insert error:", error);
          } else if (inserted) {
            existingByType.set(inserted.type, inserted.id);
          }
        }
      }

      savedMaterials = ["clean_notes", "reviewer", "flashcards", "quiz", "summary", ...(studyPack.story ? ["story"] : [])].map((type) => ({
        type,
        id: existingByType.get(type) || "",
      }));
      materials_created = savedMaterials.map((m) => m.type);
      logStep(requestId, "create_materials", `Study pack saved (${materials_created.length} material types)`, "done", { materials_created });

      // Save the school-aligned lesson boundary and initial mastery map.
      const coreConcepts = studyPack.lesson_scope?.core_concepts?.length
        ? studyPack.lesson_scope.core_concepts
        : curriculum.competency
          ? [curriculum.competency]
          : [`Understand ${classification.topic}`];
      const masteryMap: Record<string, string> = {};
      for (const concept of coreConcepts) {
        masteryMap[concept] = "started";
      }
      await supabaseAdmin!
        .from("topics")
        .update({
          lesson_scope: { confirmed_by_student: false, core_concepts: coreConcepts },
          outside_scope: studyPack.outside_scope || { advanced_concepts: [] },
          mastery_map: masteryMap,
          teacher_confirmed: false,
          last_studied_at: new Date().toISOString(),
        })
        .eq("id", topic.id);

      reply = buildStudyPackConfirmation(classification, studyPack, topic.id);
      logStep(requestId, "teach", "Study pack confirmation reply ready", "done", { replyLength: reply.length });
    }

    if (imageUrl) {
      const uploadMaterialType = attachmentType === "pdf" ? "pdf_notes" : "image_notes";
      const uploadMaterialTitle = attachmentType === "pdf" ? "Uploaded PDF" : "Uploaded Image";
      const uploadMaterialContent = getUploadMaterialContent(attachmentType, imageUrl, message);

      const { data: existingUploadMaterial } = await supabaseAdmin!
        .from("materials")
        .select("id, type")
        .eq("topic_id", topic.id)
        .eq("type", uploadMaterialType)
        .maybeSingle();

      if (existingUploadMaterial?.id) {
        const { error } = await supabaseAdmin!
          .from("materials")
          .update({ title: uploadMaterialTitle, content: uploadMaterialContent })
          .eq("id", existingUploadMaterial.id);

        if (error) {
          console.error("Upload material update error:", error);
        } else {
          savedMaterials = savedMaterials.filter((material) => material.type !== uploadMaterialType);
          savedMaterials.push({ type: uploadMaterialType, id: existingUploadMaterial.id });
        }
      } else {
        const { data: insertedUploadMaterial, error } = await supabaseAdmin!
          .from("materials")
          .insert({ topic_id: topic.id, type: uploadMaterialType, title: uploadMaterialTitle, content: uploadMaterialContent })
          .select("id, type")
          .single();

        if (error) {
          console.error("Upload material insert error:", error);
        } else if (insertedUploadMaterial) {
          savedMaterials.push({ type: insertedUploadMaterial.type, id: insertedUploadMaterial.id });
        }
      }

      if (!materials_created.includes(uploadMaterialType)) {
        materials_created.push(uploadMaterialType);
      }

      reply = buildUploadConfirmation(attachmentType, classification, topic.id);
    }

    if (!interactive && shouldCreateMaterials && topic) {
      interactive = await visualDesignerAgent(message, topic.id, topic.title, studyPack, classification, preferredModel);
    }

    if (shouldTeach) {
      const teachingQuizResult = quizResult
        ? { ...quizResult, topic: classification.topic }
        : null;

      logStep(requestId, "teach", "Teaching Agent: crafting personalized reply", "running");
      reply = await teachingAgent(message, classification.topic, curriculum, buildProfileContext(profileRow, message) || {}, replyHistory, studyPack || undefined, teachingQuizResult, classification, preferredModel, (runtime) => { modelRuntime = runtime; }, imageUrl);
      logStep(requestId, "teach", "Reply ready", "done", { replyLength: reply.length, runtime: modelRuntime });
      if (!reply || reply.length < 10) {
        reply = `Let's learn about ${classification.topic} step by step.\n\n${curriculum.competency}\n\nCan you tell me what you already know about it?`;
      }
    }

    // Visual requests: keep the reply short so the HTML widget is the star of the response.
    if (isVisualRequest && interactive) {
      reply = `Here's an interactive visual for **${classification.topic}**. Tap the cards to flip them!`;
    }

    // Visual requests: ensure the HTML widget is generated even if we only taught or had existing materials.
    if (isVisualRequest && topic && !interactive && studyPack) {
      interactive = await visualDesignerAgent(message, topic.id, topic.title, studyPack, classification, preferredModel);
    }

    if (topic && interactive?.type === "html_visual") {
      const visualMaterial = {
        topic_id: topic.id,
        type: "html_visual",
        title: interactive.title || "Visual Guide",
        content: { html: interactive.html, title: interactive.title || "Visual Guide" },
      };
      const { data: existingVisual } = await supabaseAdmin!
        .from("materials")
        .select("id")
        .eq("topic_id", topic.id)
        .eq("type", "html_visual")
        .maybeSingle();

      if (existingVisual?.id) {
        await supabaseAdmin!
          .from("materials")
          .update({ title: visualMaterial.title, content: visualMaterial.content })
          .eq("id", existingVisual.id);
      } else {
        await supabaseAdmin!.from("materials").insert(visualMaterial);
      }
      if (!materials_created.includes("html_visual")) {
        materials_created.push("html_visual");
      }
    }

    // Student-helpfulness review (demo "thinking mode"): polish the final reply before saving.
    if (reply && classification.intent !== "create_study_pack" && !imageUrl) {
      reply = await studentReplyReview(
        reply,
        message,
        classification.topic,
        curriculum,
        classification,
        profileRow || {},
        preferredModel,
        (runtime) => { modelRuntime = runtime; }
      );
    }

    // 8. Save AI reply
    logStep(requestId, "save_reply", "Saving reply to conversation history", "running");
    await supabaseAdmin!.from("messages").insert({
      user_id: userId,
      topic_id: topic.id,
      role: "assistant",
      content: reply,
    });
    logStep(requestId, "save_reply", "Reply saved", "done");

    // 9. Update topic mastery / progress
    if (topic) {
      logStep(requestId, "mastery", "Updating topic mastery", "running");
      const newProgress = computeMasteryUpdate(
        (topic.progress as Record<string, unknown>) || null,
        classification.intent,
        quizResult || null,
        message
      );
      await supabaseAdmin!
        .from("topics")
        .update({ progress: newProgress, last_studied_at: new Date().toISOString() })
        .eq("id", topic.id);
      topic.progress = newProgress;
      logStep(requestId, "mastery", `Mastery updated to ${newProgress.confidence}% (${newProgress.status})`, "done", { progress: newProgress });
    }

    // 10. Update learner profile so the demo reflects preference changes (visuals, language, etc.)
    if (shouldCreateMaterials || shouldTeach || isVisualRequest) {
      await applyMemoryUpdate(requestId, userId, message, quizResult, classification, profileRow, preferredModel);
    }

    logStep(requestId, "finish", "Response complete", "done", { materials_created, runtime: modelRuntime });

    return NextResponse.json({
      requestId,
      reply,
      classification,
      curriculum,
      topic,
      materials_created,
      saved_materials: savedMaterials,
      interactive,
      memory_update: null,
      model_runtime: modelRuntime,
    });
  } catch (err) {
    console.error("Agent error:", err);
    if (requestId) {
      logStep(requestId, "error", err instanceof Error ? err.message : "Internal error", "error");
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message, model_runtime: modelRuntime }, { status: 500 });
  }
}
