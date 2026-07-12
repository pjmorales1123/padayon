export interface AgentResponseRuntime {
  requested: "auto" | "fallback" | "gemma-3" | "gemma-4";
  provider: "fireworks" | "gemma";
  model: string;
  fallback: boolean;
}

export interface Classification {
  subject: string;
  subcategory: string;
  topic: string;
  intent: string;
  language_detected: string;
  confidence: number;
}

export interface CurriculumMatch {
  grade_level: string;
  subject: string;
  subcategory: string;
  topic: string;
  competency: string;
  previous_topic: string | null;
  next_topic: string | null;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface QuizItem {
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
}

export interface StudyPack {
  clean_notes: string;
  reviewer: string;
  flashcards: Flashcard[];
  quiz: QuizItem[];
  summary: string;
  story?: string;
  lesson_scope?: { confirmed_by_student?: boolean; core_concepts?: string[] };
  outside_scope?: { advanced_concepts?: string[] };
}

export interface MemoryUpdate {
  learning_style_update: string;
  language_confidence_update: string;
  weakness_update: string;
  strength_update: string;
  next_recommended_action: string;
  student_note: string;
}

export interface LearnerProfile {
  id: string;
  user_id: string;
  language_confidence: Record<string, string>;
  learning_style: Record<string, string>;
  strengths: string[];
  weaknesses: string[];
  study_habits: Record<string, string>;
  student_notes: import("./student-memory").StudentNote[];
  updated_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Topic {
  id: string;
  subject_id: string;
  title: string;
  subcategory: string | null;
  curriculum_match: Record<string, unknown>;
  progress: Record<string, unknown>;
  teacher_confirmed?: boolean;
  lesson_scope?: Record<string, unknown>;
  outside_scope?: Record<string, unknown>;
  mastery_map?: Record<string, unknown>;
  last_studied_at: string;
  created_at: string;
}

export interface Material {
  id: string;
  topic_id: string;
  type: string;
  title: string;
  content: Record<string, unknown>;
  created_at: string;
}

export interface Message {
  id: string;
  user_id: string;
  topic_id: string | null;
  role: string;
  content: string;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface InteractiveFlashcards {
  type: "flashcards";
  topic: string;
  topicId: string;
  cards: Flashcard[];
}

export interface InteractiveQuiz {
  type: "quiz";
  topic: string;
  topicId: string;
  questions: QuizItem[];
}

export interface InteractiveInfoCards {
  type: "info_cards";
  topic: string;
  topicId: string;
  cards: Array<{ icon?: string; title: string; body: string }>;
}

export interface InteractiveComparisonTable {
  type: "comparison_table";
  topic: string;
  topicId: string;
  headers: string[];
  rows: string[][];
}

export interface InteractiveStudyPackActions {
  type: "study_pack_actions";
  topic: string;
  topicId: string;
  actions: Array<{ label: string; materialType: string }>;
}

export interface InteractiveHtmlVisual {
  type: "html_visual";
  topic: string;
  topicId: string;
  title: string;
  html: string;
}

export type InteractivePayload =
  | InteractiveFlashcards
  | InteractiveQuiz
  | InteractiveInfoCards
  | InteractiveComparisonTable
  | InteractiveStudyPackActions
  | InteractiveHtmlVisual;
