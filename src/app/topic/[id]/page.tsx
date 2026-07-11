"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { buildAppHref } from "@/lib/navigation";

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
  "Story",
  "Progress",
];

const studyMethods = [
  { key: "eli5", label: "Explain like I'm 5" },
  { key: "mnemonic", label: "Make a mnemonic" },
  { key: "story", label: "Tell me a story" },
];

function TopicPageInner() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams?.get("userId") || DEMO_USER_ID;

  const [topic, setTopic] = useState<Topic | null>(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [quizSaveError, setQuizSaveError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [methodReply, setMethodReply] = useState<string | null>(null);
  const [methodLoading, setMethodLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/topic/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `Could not load topic (${r.status})`);
        return data;
      })
      .then((d) => {
        if (cancelled) return;
        if (d.topic) {
          setTopic(d.topic);
          setNotFound(false);
        } else {
          setNotFound(true);
        }
      })
      .catch((err) => {
        if (!cancelled) setPageError(err instanceof Error ? err.message : "Could not load topic");
      })
      .finally(() => {
        if (!cancelled) setPageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, retryCount]);

  const getMaterial = (type: string): Material | undefined =>
    topic?.materials?.find((m) => m.type === type);

  const refreshTopic = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/topic/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Could not refresh topic (${res.status})`);
      if (data.topic) setTopic(data.topic);
    } catch (err) {
      console.error("Refresh topic failed", err);
    }
  };

  const submitQuiz = async () => {
    if (!topic || !id) return;
    const questions = getMaterial("quiz")?.content?.quiz || [];
    if (questions.length === 0) return;

    setQuizSubmitting(true);
    setQuizSaveError(null);
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
          userId,
          topicId: id,
          score,
          total: questions.length,
          answers,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setQuizSaveError(data.error || `Could not save quiz (${res.status})`);
        return;
      }
      setQuizFeedback(`Score: ${score}/${questions.length} (${data.percentage}%)`);
      await refreshTopic();
    } catch (err) {
      setQuizSaveError(err instanceof Error ? err.message : "Could not save quiz");
    } finally {
      setQuizSubmitting(false);
      setShowResults(true);
    }
  };

  const renameTopic = async () => {
    const title = titleInput.trim();
    if (!title || !id) return;
    try {
      const res = await fetch(`/api/topic/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        console.error("Rename failed", data.error);
        return;
      }
      setTopic((prev) => (prev ? { ...prev, title } : prev));
      setEditingTitle(false);
    } catch (err) {
      console.error("Rename failed", err);
    }
  };

  const deleteTopic = async () => {
    if (!topic || !window.confirm(`Delete "${topic.title}" permanently?`)) return;
    try {
      const res = await fetch(`/api/topic/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        console.error("Delete failed", data.error);
        return;
      }
      router.push(buildAppHref("/library", userId));
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const runStudyMethod = async (key: string) => {
    if (!topic) return;
    const base = topic.title;
    let message = "";
    if (key === "eli5") message = `Explain ${base} like I'm 5 years old.`;
    if (key === "mnemonic") message = `Create a simple mnemonic or memory trick for ${base}.`;
    if (key === "story") message = `Tell me a short story to help me remember ${base}.`;

    setMethodLoading(true);
    setMethodReply(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMethodReply(data.error || `Request failed (${res.status})`);
        return;
      }
      setMethodReply(data.reply || "No response.");
      await refreshTopic();
    } catch (err) {
      console.error("Study method failed", err);
      setMethodReply("Something went wrong. Please try again.");
    } finally {
      setMethodLoading(false);
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
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            {m?.content?.text ? (
              <MarkdownRenderer>{m.content.text}</MarkdownRenderer>
            ) : (
              <p className="text-slate-400">No clean notes yet.</p>
            )}
          </div>
        );
      }
      case "Reviewer": {
        const m = getMaterial("reviewer");
        return (
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            {m?.content?.text ? (
              <MarkdownRenderer>{m.content.text}</MarkdownRenderer>
            ) : (
              <p className="text-slate-400">No reviewer yet.</p>
            )}
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
            {quizSaveError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                <p className="font-medium">Could not save your quiz</p>
                <p>{quizSaveError}</p>
                <button
                  onClick={submitQuiz}
                  disabled={quizSubmitting}
                  className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Retry save
                </button>
              </div>
            )}
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
      case "Story": {
        const m = getMaterial("story");
        return (
          <div className="rounded-xl bg-white border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-3">A story to remember {topic.title}</h2>
            {m?.content?.text ? (
              <MarkdownRenderer>{m.content.text}</MarkdownRenderer>
            ) : (
              <p className="text-slate-700 leading-relaxed">
                No story yet. Try asking PADAYON to tell you a story about this topic.
              </p>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          {editingTitle ? (
            <input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && renameTopic()}
              onBlur={renameTopic}
              autoFocus
              className="text-2xl font-bold text-slate-900 rounded border border-slate-300 px-2 py-1"
            />
          ) : (
            <h1 className="text-2xl font-bold text-slate-900 truncate">
              {topic?.title || "Topic"}
            </h1>
          )}
          <button
            onClick={() => {
              setEditingTitle(true);
              setTitleInput(topic?.title || "");
            }}
            className="text-sm text-slate-500 hover:text-blue-600 shrink-0"
          >
            Rename
          </button>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={buildAppHref("/library", userId)}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back
          </Link>
          <button
            onClick={deleteTopic}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      {pageLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-slate-500">Loading topic...</p>
        </div>
      )}

      {!pageLoading && notFound && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-lg font-semibold text-slate-900 mb-2">Topic not found</p>
          <p className="text-sm text-slate-500 mb-4">The topic you are looking for does not exist or was deleted.</p>
          <Link
            href={buildAppHref("/library", userId)}
            className="inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Back to Library
          </Link>
        </div>
      )}

      {!pageLoading && pageError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-800 mb-3">{pageError}</p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {!pageLoading && !pageError && !notFound && (
        <>
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Study methods</h3>
            <div className="flex flex-wrap gap-2">
              {studyMethods.map((m) => (
                <button
                  key={m.key}
                  onClick={() => runStudyMethod(m.key)}
                  disabled={methodLoading}
                  className="rounded-lg bg-white border border-blue-200 text-blue-800 px-3 py-1.5 text-sm hover:bg-blue-100 disabled:opacity-50"
                >
                  {m.label}
                </button>
              ))}
            </div>
            {methodLoading && (
              <p className="text-sm text-blue-700 mt-2 flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Asking PADAYON...
              </p>
            )}
            {methodReply && (
              <div className="mt-3 text-sm text-slate-800 bg-white rounded-lg p-3 border border-blue-100">
                <MarkdownRenderer>{methodReply}</MarkdownRenderer>
              </div>
            )}
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
        </>
      )}
    </main>
  );
}

export default function TopicPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading topic...</div>}>
      <TopicPageInner />
    </Suspense>
  );
}
