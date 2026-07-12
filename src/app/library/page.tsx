"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buildAppHref } from "@/lib/navigation";

const DEMO_USER_ID = "demo-user-id";

interface Material {
  id: string;
  title: string;
  type: string;
}

interface Topic {
  id: string;
  title: string;
  subcategory: string;
  materials: Material[];
  last_studied_at: string;
  progress?: {
    confidence?: number;
    status?: string;
    attempts?: number;
    correct?: number;
    incorrect?: number;
  } | null;
}

interface Subject {
  id: string;
  name: string;
  topics: Topic[];
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

function LibraryInner() {
  const searchParams = useSearchParams();
  const userId = searchParams?.get("userId") || DEMO_USER_ID;

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [operationError, setOperationError] = useState<string | null>(null);

  const refreshSubjects = useCallback(() => {
    return fetch(`/api/library?userId=${userId}`)
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (!res.ok) {
          throw new Error(data.error || `Could not load library (${res.status})`);
        }
        if (data.subjects) {
          setSubjects(data.subjects);
          const first = data.subjects[0]?.id;
          if (first) {
            setExpanded((prev) => ({ ...prev, [first]: true }));
          }
        }
      });
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    refreshSubjects()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load library");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshSubjects, retryCount]);

  const createSubject = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setOperationError(null);
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setOperationError(data.error || `Create failed (${res.status})`);
        return;
      }
      setNewName("");
      setExpanded((prev) => ({ ...prev, [data.subject.id]: true }));
      await refreshSubjects();
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const renameSubject = async (subjectId: string) => {
    const name = editingName.trim();
    if (!name) return;
    setOperationError(null);
    try {
      const res = await fetch("/api/library", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, name }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setOperationError(data.error || `Rename failed (${res.status})`);
        return;
      }
      setEditingId(null);
      await refreshSubjects();
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "Rename failed");
    }
  };

  const deleteSubject = async (subjectId: string, name: string) => {
    if (!window.confirm(`Delete folder "${name}" and all its topics?`)) return;
    setOperationError(null);
    try {
      const res = await fetch(`/api/library?subjectId=${subjectId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setOperationError(data.error || `Delete failed (${res.status})`);
        return;
      }
      await refreshSubjects();
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const deleteTopic = async (topicId: string, title: string) => {
    if (!window.confirm(`Delete topic "${title}"?`)) return;
    setOperationError(null);
    try {
      const res = await fetch(`/api/topic/${topicId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setOperationError(data.error || `Delete failed (${res.status})`);
        return;
      }
      await refreshSubjects();
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredSubjects = subjects
    .map((subject) => ({
      ...subject,
      topics: (subject.topics || []).filter(
        (t) =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.subcategory?.toLowerCase().includes(search.toLowerCase()) ||
          subject.name.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((s) => s.topics.length > 0 || s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Library</h1>
      </div>

      {operationError && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {operationError}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createSubject()}
          placeholder="New folder name (e.g. Science)"
          className="flex-1 rounded-xl border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={createSubject}
          disabled={creating || !newName.trim()}
          className="rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? "..." : "Add Folder"}
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search folders or topics..."
        className="w-full rounded-xl border border-slate-300 px-4 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {loading && (
        <div className="space-y-4">
          <SkeletonBlock className="h-12 w-full" />
          <SkeletonBlock className="h-12 w-full" />
          <SkeletonBlock className="h-12 w-3/4" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-800 mb-3">{error}</p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-6">
          {filteredSubjects.map((subject) => (
            <div key={subject.id} className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between gap-3 p-4 bg-slate-50 border-b border-slate-200">
                <button
                  onClick={() => toggle(subject.id)}
                  className="flex items-center gap-2 text-left min-w-0"
                >
                  <span className="text-lg">{expanded[subject.id] ? "📂" : "📁"}</span>
                  {editingId === subject.id ? (
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && renameSubject(subject.id)}
                      onBlur={() => renameSubject(subject.id)}
                      autoFocus
                      className="rounded border border-slate-300 px-2 py-1 text-slate-900"
                    />
                  ) : (
                    <span className="font-semibold text-slate-800 truncate">{subject.name}</span>
                  )}
                  <span className="text-xs text-slate-500 shrink-0">{(subject.topics || []).length}</span>
                </button>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setEditingId(subject.id);
                      setEditingName(subject.name);
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-blue-600"
                    title="Rename folder"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => deleteSubject(subject.id, subject.name)}
                    className="text-xs font-medium text-red-500 hover:text-red-700"
                    title="Delete folder"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expanded[subject.id] && (
                <div className="divide-y divide-slate-100 p-2">
                  {(subject.topics || []).length === 0 && (
                    <p className="p-4 text-sm text-slate-400">No topics yet. Start studying in chat.</p>
                  )}
                  {(subject.topics || []).map((topic) => {
                    const confidence = topic.progress?.confidence ?? 0;
                    const status = topic.progress?.status || "started";
                    const statusClasses =
                      status === "mastered"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : status === "developing"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-blue-50 text-blue-700 border-blue-200";
                    const barColor =
                      status === "mastered" ? "bg-emerald-500" : status === "developing" ? "bg-amber-500" : "bg-blue-500";
                    const imageCount = topic.materials?.filter((m) => m.type === "image_notes").length || 0;
                    const pdfCount = topic.materials?.filter((m) => m.type === "pdf_notes").length || 0;
                    const hasReviewer = topic.materials?.some((m) => m.type === "reviewer") || false;
                    const hasFlashcards = topic.materials?.some((m) => m.type === "flashcards") || false;
                    const hasQuiz = topic.materials?.some((m) => m.type === "quiz") || false;
                    const updated = topic.last_studied_at
                      ? new Date(topic.last_studied_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                      : "";
                    return (
                      <div
                        key={topic.id}
                        className="group flex items-center justify-between gap-4 p-4 rounded-xl hover:bg-slate-50 transition"
                      >
                        <Link
                          href={buildAppHref(`/topic/${topic.id}`, userId)}
                          className="min-w-0 flex-1"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-800 group-hover:text-blue-600 truncate">
                              {topic.title}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${statusClasses}`}>
                              {status}
                            </span>
                          </div>
                          {topic.subcategory && (
                            <p className="text-xs text-slate-500 truncate">{topic.subcategory}</p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
                            {imageCount > 0 && <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5">📷 {imageCount} image{imageCount > 1 ? "s" : ""}</span>}
                            {pdfCount > 0 && <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5">📄 {pdfCount} PDF{pdfCount > 1 ? "s" : ""}</span>}
                            {hasReviewer && <span className="inline-flex items-center gap-1 rounded-md bg-green-50 text-green-700 px-2 py-0.5">✓ Reviewer</span>}
                            {hasFlashcards && <span className="inline-flex items-center gap-1 rounded-md bg-green-50 text-green-700 px-2 py-0.5">✓ Flashcards</span>}
                            {hasQuiz && <span className="inline-flex items-center gap-1 rounded-md bg-green-50 text-green-700 px-2 py-0.5">✓ Quiz</span>}
                            {updated && <span className="text-slate-400">Updated {updated}</span>}
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <div className="h-1.5 flex-1 max-w-[10rem] rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={`h-full ${barColor} transition-all`}
                                style={{ width: `${confidence}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-500">{confidence}%</span>
                          </div>
                        </Link>
                        <button
                          onClick={() => deleteTopic(topic.id, topic.title)}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs font-medium text-red-500 hover:text-red-700 shrink-0 transition"
                          title="Delete topic"
                        >
                          Delete
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {filteredSubjects.length === 0 && (
            <div className="text-center text-slate-400 py-12">
              {search ? "No folders or topics match your search." : "No subjects yet. Start studying in the chat!"}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default function Library() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading library...</div>}>
      <LibraryInner />
    </Suspense>
  );
}
