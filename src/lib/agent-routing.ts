import { ChatMessage } from "./types";

const OFFICIAL_TOPIC_INTENTS = new Set([
  "create_study_pack",
  "make_flashcards",
  "make_reviewer",
  "make_quiz",
  "make_story",
  "make_visual",
  "retrieve_material",
  "continue_learning",
]);

const HISTORY_AWARE_INTENTS = new Set(["continue_learning", "retrieve_material"]);

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

export function getReplyHistoryForIntent(intent: string, history: ChatMessage[]) {
  return HISTORY_AWARE_INTENTS.has(intent) ? history : [];
}
