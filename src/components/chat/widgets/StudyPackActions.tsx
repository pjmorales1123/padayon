"use client";

import Link from "next/link";

interface StudyPackActionsProps {
  topic: string;
  topicId: string;
  userId: string;
  actions: Array<{ label: string; materialType: string }>;
}

export default function StudyPackActions({ topic, topicId, userId, actions }: StudyPackActionsProps) {
  if (!actions || actions.length === 0) {
    return (
      <Link
        href={`/topic/${topicId}?userId=${userId}`}
        className="inline-block rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700"
      >
        View study pack →
      </Link>
    );
  }

  const tabForType = (type: string) => {
    switch (type) {
      case "clean_notes":
        return "Clean Notes";
      case "reviewer":
        return "Reviewer";
      case "flashcards":
        return "Flashcards";
      case "quiz":
        return "Quiz";
      case "story":
        return "Story";
      default:
        return "Overview";
    }
  };

  return (
    <div className="w-full">
      <p className="text-xs font-medium text-slate-500 mb-2">Study pack · {topic}</p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action, i) => (
          <Link
            key={i}
            href={`/topic/${topicId}?userId=${userId}&tab=${encodeURIComponent(tabForType(action.materialType))}`}
            className="rounded-lg bg-white border border-blue-200 text-blue-800 px-4 py-2 text-sm font-medium hover:bg-blue-50 transition min-h-[44px] flex items-center"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
