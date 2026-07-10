"use client";

import { useState } from "react";
import type { QuizItem } from "@/lib/types";

interface MiniQuizProps {
  topic: string;
  questions: QuizItem[];
}

export default function MiniQuiz({ topic, questions }: MiniQuizProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);

  if (!questions || questions.length === 0) {
    return <div className="text-slate-400 text-sm">No quiz questions available.</div>;
  }

  const score = questions.reduce((acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0), 0);

  const select = (qIndex: number, choice: string) => {
    if (showResults) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: choice }));
  };

  const allAnswered = questions.every((_, i) => answers[i]);

  return (
    <div className="w-full">
      <p className="text-xs font-medium text-slate-500 mb-2">Quick Quiz · {topic}</p>
      <div className="space-y-4">
        {questions.map((q, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="font-medium text-slate-800 mb-2">
                {i + 1}. {q.question}
              </p>
              <div className="grid gap-2">
                {q.choices.map((choice, j) => {
                  const letter = String.fromCharCode(65 + j);
                  const selected = answers[i] === choice;
                  const showCorrect = showResults && choice === q.answer;
                  const showWrong = showResults && selected && choice !== q.answer;
                  return (
                    <button
                      key={j}
                      onClick={() => select(i, choice)}
                      className={`text-left rounded-lg px-3 py-2.5 text-sm border transition min-h-[44px] ${
                        showCorrect
                          ? "bg-green-100 border-green-300 text-green-900"
                          : showWrong
                          ? "bg-red-100 border-red-300 text-red-900"
                          : selected
                          ? "bg-blue-100 border-blue-300 text-blue-900"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="font-semibold mr-2">{letter}.</span>
                      {choice}
                    </button>
                  );
                })}
              </div>
              {showResults && (
                <p className="mt-2 text-xs text-slate-600">
                  <span className="font-semibold">Answer:</span> {q.answer}
                  {q.explanation && <> · {q.explanation}</>}
                </p>
              )}
            </div>
        ))}
      </div>
      {!showResults ? (
        <button
          onClick={() => setShowResults(true)}
          disabled={!allAnswered}
          className="mt-4 w-full rounded-xl bg-blue-600 text-white py-2.5 font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          Check Answers
        </button>
      ) : (
        <div className="mt-4 rounded-xl bg-slate-100 p-3 text-center text-slate-800 font-medium">
          Score: {score}/{questions.length} ({Math.round((score / questions.length) * 100)}%)
        </div>
      )}
    </div>
  );
}
