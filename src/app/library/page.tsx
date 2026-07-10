"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const DEMO_USER_ID = "demo-user-id";

interface Material {
  id: string;
  title: string;
}

interface Topic {
  id: string;
  title: string;
  subcategory: string;
  materials: Material[];
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

  const loadSubjects = useCallback(() => {
    fetch(`/api/library?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.subjects) {
          setSubjects(d.subjects);
          const first = d.subjects[0]?.id;
          if (first) {
            setExpanded((prev) => ({ ...prev, [first]: true }));
          }
        }
      });
  }, [userId]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const createSubject = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name }),
      });
      const data = await res.json();
      if (data.success) {
        setNewName("");
        setExpanded((prev) => ({ ...prev, [data.subject.id]: true }));
        loadSubjects();
      }
    } finally {
      setCreating(false);
    }
  };

  const renameSubject = async (subjectId: string) => {
    const name = editingName.trim();
    if (!name) return;
    const res = await fetch("/api/library", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId, name }),
    });
    const data = await res.json();
    if (data.success) {
      setEditingId(null);
      loadSubjects();
    }
  };

  const deleteSubject = async (subjectId: string, name: string) => {
    if (!window.confirm(`Delete folder "${name}" and all its topics?`)) return;
    const res = await fetch(`/api/library?subjectId=${subjectId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) loadSubjects();
  };

  const deleteTopic = async (topicId: string, title: string) => {
    if (!window.confirm(`Delete topic "${title}"?`)) return;
    const res = await fetch(`/api/topic/${topicId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) loadSubjects();
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
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Library</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Home
        </Link>
      </div>

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

      <div className="grid gap-4">
        {filteredSubjects.map((subject) => (
          <div key={subject.id} className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-200">
              <button
                onClick={() => toggle(subject.id)}
                className="flex items-center gap-2 text-left"
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
                  <span className="font-bold text-slate-800">{subject.name}</span>
                )}
                <span className="text-xs text-slate-500">({(subject.topics || []).length})</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingId(subject.id);
                    setEditingName(subject.name);
                  }}
                  className="text-xs text-slate-500 hover:text-blue-600"
                >
                  Rename
                </button>
                <button
                  onClick={() => deleteSubject(subject.id, subject.name)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>

            {expanded[subject.id] && (
              <div className="p-4 space-y-3">
                {(subject.topics || []).length === 0 && (
                  <p className="text-sm text-slate-400">No topics yet. Start studying in chat.</p>
                )}
                {(subject.topics || []).map((topic) => {
                  const confidence = topic.progress?.confidence ?? 0;
                  const status = topic.progress?.status || "started";
                  const statusColor =
                    status === "mastered" ? "bg-emerald-500" : status === "developing" ? "bg-amber-500" : "bg-blue-500";
                  return (
                  <div
                    key={topic.id}
                    className="flex items-start justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/topic/${topic.id}?userId=${userId}`}
                          className="font-semibold text-slate-800 hover:text-blue-600"
                        >
                          {topic.subcategory ? `${topic.subcategory} → ` : ""}
                          {topic.title}
                        </Link>
                        <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                          {status}
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                          <span>Mastery {confidence}%</span>
                          <span>{topic.progress?.correct ?? 0}/{topic.progress?.attempts ?? 0} correct</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full ${statusColor} transition-all`}
                            style={{ width: `${confidence}%` }}
                          />
                        </div>
                      </div>
                      <div className="ml-4 mt-2 flex flex-wrap gap-2">
                        {(topic.materials || []).map((m) => (
                          <Link
                            key={m.id}
                            href={`/topic/${topic.id}?userId=${userId}`}
                            className="inline-block rounded-lg bg-white px-3 py-1 text-sm text-slate-600 border border-slate-200 hover:bg-slate-100 transition"
                          >
                            {m.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTopic(topic.id, topic.title)}
                      className="text-xs text-red-500 hover:text-red-700 ml-2"
                    >
                      Delete
                    </button>
                  </div>
                ); })}
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
