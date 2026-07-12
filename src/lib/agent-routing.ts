import { ChatMessage } from "./types";

export interface RetrievedMaterialContent {
  text?: string;
  reviewer?: string;
  flashcards?: Array<{ front: string; back: string }>;
  quiz?: Array<{ question: string; choices: string[]; answer: string }>;
}

export interface LastLesson {
  subjectName: string;
  subcategory: string | null;
  topicTitle: string;
}

const OFFICIAL_TOPIC_INTENTS = new Set([
  "create_study_pack",
  "make_flashcards",
  "make_reviewer",
  "make_quiz",
  "make_summary",
  "make_story",
  "make_visual",
  "retrieve_material",
  "continue_learning",
]);

const HISTORY_AWARE_INTENTS = new Set(["continue_learning", "retrieve_material", "make_summary"]);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPriorUserTopicMention(topic: string, history: ChatMessage[]) {
  const normalizedTopic = normalizeText(topic);
  if (!normalizedTopic) return false;

  const topicWords = normalizedTopic.split(" ").filter((word) => word.length > 2);
  const distinctiveTopicWords = topicWords.filter((word) => word.length >= 5);
  return history.some((message) => {
    if (message.role !== "user") return false;
    const content = normalizeText(message.content);
    if (content.includes(normalizedTopic)) return true;
    if (topicWords.length > 1 && topicWords.every((word) => content.includes(word))) return true;
    return distinctiveTopicWords.some((word) => content.includes(word));
  });
}

export function shouldPersistTopicForTurn({
  intent,
  topic,
  hasUpload,
  history,
}: {
  intent: string;
  topic: string;
  hasUpload: boolean;
  history: ChatMessage[];
}) {
  if (hasUpload) return true;
  if (OFFICIAL_TOPIC_INTENTS.has(intent)) return true;
  if (intent !== "teach_topic") return false;
  return hasPriorUserTopicMention(topic, history);
}

function hasStudyMaterialContext(history: ChatMessage[]) {
  return history.some((message) =>
    /quiz|test|question|flashcard|flash card|reviewer|review material|study material|study pack/i.test(message.content)
  );
}

export function getUploadConfirmation(attachmentType?: string, history: ChatMessage[] = []) {
  const saved = attachmentType === "pdf"
    ? "Placed one PDF on your library and saved the contents."
    : "Placed one picture on your library and saved the contents.";

  if (hasStudyMaterialContext(history)) {
    return `${saved} Should I include this in your quiz, make flashcards, or create review material from it?`;
  }

  return `${saved} What would you like to do with it next?`;
}

export function getUploadMaterialContent(attachmentType: string | undefined, imageUrl: string, text: string) {
  return attachmentType === "pdf"
    ? { preview_image_url: imageUrl, text }
    : { image_url: imageUrl, text };
}

export function isLastLessonQuestion(message: string) {
  return /last lesson|previous lesson|previous topic|last topic|what did we (learn|discuss)|where did we (leave off|stop)|last time/i.test(message);
}

export function getLastLessonReply(lastLesson: LastLesson) {
  const location = lastLesson.subcategory
    ? `${lastLesson.subjectName} → ${lastLesson.subcategory}`
    : lastLesson.subjectName;
  return `Your last lesson was **${lastLesson.topicTitle}** in ${location}. What would you like to do next: see the clean notes, review flashcards, take the quiz, or view a visual guide?`;
}

export function formatRetrievedMaterial(type: string, content: RetrievedMaterialContent): string {
  if (type === "flashcards" && content.flashcards) {
    return "\n\n" + content.flashcards.map((card, index) => `${index + 1}. ${card.front}\n   → ${card.back}`).join("\n\n");
  }
  if (type === "quiz" && content.quiz) {
    return "\n\n" + content.quiz.map((question, index) => (
      `${index + 1}. ${question.question}\n   ${question.choices.map((choice, choiceIndex) => `${String.fromCharCode(65 + choiceIndex)}. ${choice}`).join("\n   ")}\n   Answer: ${question.answer}`
    )).join("\n\n");
  }
  if (type === "reviewer") return "\n\n" + (content.reviewer || "");
  if (type === "clean_notes" || type === "summary" || type === "story") return "\n\n" + (content.text || "");
  return "";
}

export function getReplyHistoryForIntent(intent: string, history: ChatMessage[]) {
  return HISTORY_AWARE_INTENTS.has(intent) ? history : [];
}
