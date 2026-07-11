"use client";

import dynamic from "next/dynamic";
import type { InteractivePayload } from "@/lib/types";

const FlashcardDeck = dynamic(() => import("./widgets/FlashcardDeck"), { ssr: false });
const MiniQuiz = dynamic(() => import("./widgets/MiniQuiz"), { ssr: false });
const InfoCards = dynamic(() => import("./widgets/InfoCards"), { ssr: false });
const ComparisonTable = dynamic(() => import("./widgets/ComparisonTable"), { ssr: false });
const StudyPackActions = dynamic(() => import("./widgets/StudyPackActions"), { ssr: false });
const HtmlVisual = dynamic(() => import("./widgets/HtmlVisual"), { ssr: false });

interface InteractiveMessageProps {
  payload: InteractivePayload;
  userId: string;
}

export default function InteractiveMessage({ payload, userId }: InteractiveMessageProps) {
  switch (payload.type) {
    case "flashcards":
      return <FlashcardDeck topic={payload.topic} cards={payload.cards} />;
    case "quiz":
      return <MiniQuiz topic={payload.topic} questions={payload.questions} />;
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
