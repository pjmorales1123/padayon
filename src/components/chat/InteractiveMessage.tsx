"use client";

import type { InteractivePayload } from "@/lib/types";
import FlashcardDeck from "./widgets/FlashcardDeck";
import MiniQuiz from "./widgets/MiniQuiz";
import InfoCards from "./widgets/InfoCards";
import ComparisonTable from "./widgets/ComparisonTable";
import StudyPackActions from "./widgets/StudyPackActions";
import HtmlVisual from "./widgets/HtmlVisual";

interface InteractiveMessageProps {
  payload: InteractivePayload;
  userId: string;
}

export default function InteractiveMessage({ payload, userId }: InteractiveMessageProps) {
  switch (payload.type) {
    case "flashcards":
      return <FlashcardDeck topic={payload.topic} cards={payload.cards} />;
    case "quiz":
      return <MiniQuiz userId={userId} topic={payload.topic} topicId={payload.topicId} questions={payload.questions} />;
    case "info_cards":
      return <InfoCards topic={payload.topic} cards={payload.cards} />;
    case "comparison_table":
      return (
        <ComparisonTable
          topic={payload.topic}
          headers={payload.headers}
          rows={payload.rows}
        />
      );
    case "study_pack_actions":
      return (
        <StudyPackActions
          topic={payload.topic}
          topicId={payload.topicId}
          userId={userId}
          actions={payload.actions}
        />
      );
    case "html_visual":
      return <HtmlVisual topic={payload.topic} title={payload.title} html={payload.html} />;
    default:
      return null;
  }
}
