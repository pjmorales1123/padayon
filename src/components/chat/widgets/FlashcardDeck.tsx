"use client";

import { useState } from "react";
import type { Flashcard } from "@/lib/types";

interface FlashcardDeckProps {
  topic: string;
  cards: Flashcard[];
}

export default function FlashcardDeck({ topic, cards }: FlashcardDeckProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards || cards.length === 0) {
    return <div className="text-slate-400 text-sm">No flashcards available.</div>;
  }

  const current = cards[index];

  const next = () => {
    setFlipped(false);
    setIndex((i) => (i + 1) % cards.length);
  };

  const prev = () => {
    setFlipped(false);
    setIndex((i) => (i - 1 + cards.length) % cards.length);
  };

  return (
    <div className="w-full">
      <p className="text-xs font-medium text-slate-500 mb-2">Flashcards · {topic}</p>
      <div
        onClick={() => setFlipped((f) => !f)}
        className="relative min-h-[140px] rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 cursor-pointer transition hover:shadow-md select-none"
        role="button"
        aria-label="Flip flashcard"
      >
        <div className="text-center">
          <p className="text-sm text-slate-500 mb-1">{flipped ? "Answer" : "Question"}</p>
          <p className="text-lg font-semibold text-slate-800">
            {flipped ? current.back : current.front}
          </p>
        </div>
        <p className="absolute bottom-2 right-3 text-[10px] text-slate-400">
          Tap to flip
        </p>
      </div>
      <div className="flex items-center justify-between mt-3">
        <button
          onClick={prev}
          className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 min-w-[44px]"
          aria-label="Previous card"
        >
          ← Prev
        </button>
        <span className="text-xs text-slate-500">
          {index + 1} / {cards.length}
        </span>
        <button
          onClick={next}
          className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 min-w-[44px]"
          aria-label="Next card"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
