"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const DEMO_USER_ID = "demo-user-id";

interface Material {
  id: string;
  type: string;
  title: string;
  content: {
    text?: string;
    flashcards?: Array<{ front: string; back: string }>;
    quiz?: Array<{ question: string; choices: string[]; answer: string; explanation?: string }>;
  };
}

interface Subject {
  id: string;
  name: string;
}

interface Topic {
  id: string;
  title: string;
  subcategory: string;
  curriculum_match: { competency?: string };
  progress: {
    quiz_attempts?: number;
    best_score?: number;
    last_score?: number;
    passed?: boolean;
  };
  last_studied_at: string;
  subjects: Subject;
  materials: Material[];
}

const tabs = [
  "Overview",
  "Original Notes",
  "Clean Notes",
  "Reviewer",
  "Flashcards",
  "Quiz",
  "Progress",
];

export default function TopicPage() {
  const { id } = useParams() as { id: string };
  const [topic, setTopic] = useState<Topic | null>(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/topic/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.topic) setTopic(d.topic);
      });
  }, [id]);

  const getMaterial = (type: string): Material | undefined =>
    topic?.materials?.find((m) => m.type === type);

  const submitQuiz = async () => {
    if (!topic || !id) return;
    const questions = getMaterial("quiz")?.content?.quiz || [];
    if (questions.length === 0) return;

    setQuizSubmitting(true);
    let score = 0;
    const answers: Array<{ questionIndex: number; selected: string; correct: boolean }> = [];

    questions.forEach((q, i) => {
      const selected = quizAnswers[i] || "";
      const correct = selected === q.answer;
      if (correct) score++;
      answers.push({ questionIndex: i, selected, correct });
    });

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          topicId: id,
          score,
          total: questions.length,
          answers,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQuizFeedback(`Score: ${score}/${questions.length} (${data.percentage}%)`);
        // Refresh topic to show updated progress
        const refreshed = await fetch(`/api/topic/${id}`).then((r) => r.json());
        if (refreshed.topic) setTopic(refreshed.topic);
      }
    } catch (err) {
      console.error("Quiz submit failed", err);
    } finally {
      setQuizSubmitting(false);
      setShowResults(true);
    }
  };

  const renderProgress = () => {
    if (!topic) return <div className="text-slate-400">Loading...</div>;
    const progress = topic.progress || {};
    const attempts = progress.quiz_attempts || 0;
    const bestScore = progress.best_score || 0;
    const lastScore = progress.last_score || 0;
    const passed = progress.passed || false;

    return (
      <div className="space-y-5">
        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Quiz Mastery</h2>
          <div className="flex items-center gap-4 mb-2">
            <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${bestScore}%` }}
              />
            </div>
            <span className="font-semibold text-slate-800">{bestScore}%</span>
          </div>
          <p className="text-sm text-slate-600">
            {attempts === 0
              ? "No quiz attempts yet."
              : `Best score: ${bestScore}% across ${attempts} attempt${attempts === 1 ? "" : "s"}.`}
          </p>
          {attempts > 0 && (
            <p className="text-sm text-slate-600 mt-1">
              Last attempt: {lastScore}% ·{" "}
              {passed ? (
                <span className="text-green-600 font-medium">Passed</span>
              ) : (
                <span className="text-amber-600 font-medium">Keep practicing</span>
              )}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Study Activity</h2>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>
              <strong>Last studied:</strong>{" "}
              {topic.last_studied_at
                ? new Date(topic.last_studied_at).toLocaleString()
                : "Never"}
            </li>
            <li>
              <strong>Competency:</strong>{" "}
              {topic.curriculum_match?.competency || "Not aligned yet"}
            </li>
            <li>
              <strong>Materials saved:</strong>{" "}
              {(topic.materials || []).map((m) => m.title).join(", ") || "None"}
            </li>
          </ul>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (!topic) return <div className="text-slate-400">Loading...</div>;

    switch (activeTab) {
      case "Overview":
        return (
          <div className="space-y-3">
            <p className="text-slate-700">
              <strong>Subject:</strong> {topic.subjects?.name}
            </p>
            <p className="text-slate-700">
              <strong>Subcategory:</strong> {topic.subcategory}
            </p>
            <p className="text-slate-700">
              <strong>Competency:</strong> {topic.curriculum_match?.competency}
            </p>
            <p className="text-slate-700">
              <strong>Last studied:</strong>{" "}
              {new Date(topic.last_studied_at).toLocaleDateString()}
            </p>
          </div>
        );
      case "Original Notes": {
        const m = getMaterial("original_notes");
        return (
          <div className="whitespace-pre-wrap text-slate-800 bg-slate-50 rounded-xl p-4 border border-slate-200">
            {m?.content?.text || "No original notes saved."}
          </div>
        );
      }
      case "Clean Notes": {
        const m = getMaterial("clean_notes");
        return (
          <div className="whitespace-pre-wrap text-slate-800 bg-slate-50 rounded-xl p-4 border border-slate-200">
            {m?.content?.text || "No clean notes yet."}
          </div>
        );
      }
      case "Reviewer": {
        const m = getMaterial("reviewer");
        return (
          <div className="whitespace-pre-wrap text-slate-800 bg-slate-50 rounded-xl p-4 border border-slate-200">
            {m?.content?.text || "No reviewer yet."}
          </div>
        );
      }
      case "Flashcards": {
        const m = getMaterial("flashcards");
        const cards = m?.content?.flashcards || [];
        return (
          <div className="grid gap-3">
            {cards.length === 0 && (
              <div className="text-slate-400">No flashcards yet.</div>
            )}
            {cards.map((card, i) => (
              <div
                key={i}
                className="rounded-xl bg-white border border-slate-200 p-4 hover:shadow-md transition cursor-pointer"
                onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                  const el = e.currentTarget;
                  el.classList.toggle("bg-blue-50");
                  const back = el.querySelector(".back");
                  if (back) back.classList.toggle("hidden");
                }}
              >
                <div className="font-semibold text-slate-800 mb-1">{card.front}</div>
                <div className="back hidden text-slate-600">{card.back}</div>
              </div>
            ))}
          </div>
        );
      }
      case "Quiz": {
        const m = getMaterial("quiz");
        const questions = m?.content?.quiz || [];
        return (
          <div className="space-y-4">
            {questions.length === 0 && (
              <div className="text-slate-400">No quiz yet.</div>
            )}
            {questions.map((q, i) => (
              <div key={i} className="rounded-xl bg-white border border-slate-200 p-4">
                <div className="font-semibold text-slate-800 mb-2">
                  {i + 1}. {q.question}
                </div>
                <div className="grid gap-2">
                  {q.choices.map((c: string, j: number) => {
                    const letter = String.fromCharCode(65 + j);
                    const selected = quizAnswers[i] === c;
                    const isCorrect = showResults && c === q.answer;
                    const isWrong = showResults && selected && c !== q.answer;
                    return (
                      <button
                        key={j}
                        onClick={() => {
                          if (showResults) return;
                          setQuizAnswers((prev) => ({ ...prev, [i]: c }));
                        }}
                        className={`text-left rounded-lg px-3 py-2 border transition ${
                          isCorrect
                            ? "bg-green-100 border-green-300"
                            : isWrong
                            ? "bg-red-100 border-red-300"
                            : selected
                            ? "bg-blue-100 border-blue-300"
                            : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {letter}. {c}
                      </button>
                    );
                  })}
                </div>
                {showResults && (
                  <div className="mt-2 text-sm text-slate-600">
                    <strong>Answer:</strong> {q.answer}
                    <br />
                    {q.explanation}
                  </div>
                )}
              </div>
            ))}
            {quizFeedback && (
              <div className="rounded-xl bg-slate-100 p-4 text-slate-800 font-medium">
                {quizFeedback}
              </div>
            )}
            {questions.length > 0 && !showResults && (
              <button
                onClick={submitQuiz}
                disabled={quizSubmitting}
                className="rounded-xl bg-blue-600 text-white px-5 py-2 font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {quizSubmitting ? "Checking..." : "Check Answers"}
              </button>
            )}
          </div>
        );
      }
      case "Progress":
        return renderProgress();
      default:
        return null;
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-900">
          {topic?.title || "Topic"}
        </h1>
        <Link href="/library" className="text-sm text-blue-600 hover:underline">
          Library
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto mb-6 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setShowResults(false);
            }}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === tab
                ? "bg-blue-600 text-white"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {renderContent()}
    </main>
  );
}
