"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DEMO_USER_ID = "demo-user-id";

interface Topic {
  id: string;
  title: string;
  subcategory: string;
  last_studied_at: string;
  subjectName: string;
}

interface Subject {
  id: string;
  name: string;
  topics: Topic[];
}

interface HealthStatus {
  ready: boolean;
  message: string;
}

export default function Home() {
  const [name, setName] = useState("Student");
  const [recentTopics, setRecentTopics] = useState<Topic[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  const loadData = () => {
    fetch(`/api/profile?userId=${DEMO_USER_ID}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.name) setName(d.user.name);
      });

    fetch(`/api/library?userId=${DEMO_USER_ID}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.subjects) {
          setSubjects(d.subjects);
          const topics: Topic[] = d.subjects.flatMap((s: Subject) =>
            (s.topics || []).map((t) => ({ ...t, subjectName: s.name }))
          );
          topics.sort(
            (a, b) =>
              new Date(b.last_studied_at).getTime() - new Date(a.last_studied_at).getTime()
          );
          setRecentTopics(topics.slice(0, 3));
        }
      });
  };

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setHealth(d))
      .catch(() => setHealth({ ready: false, message: "Could not reach backend." }));

    loadData();
  }, []);

  const seed = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: DEMO_USER_ID }),
      });
      const data = await res.json();
      if (data.success) {
        setSeedResult("Demo user and curriculum seeded.");
        loadData();
      } else {
        setSeedResult(`Seed failed: ${data.error || "Unknown error"}`);
      }
    } catch {
      setSeedResult("Seed failed. Make sure the migration has been run.");
    } finally {
      setSeeding(false);
    }
  };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {health && !health.ready && (
        <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-900">
          <p className="font-semibold mb-1">Database not ready</p>
          <p className="text-sm mb-3">{health.message}</p>
          <button
            onClick={seed}
            disabled={seeding}
            className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
          >
            {seeding ? "Seeding..." : "Try Seed Anyway"}
          </button>
          {seedResult && <p className="text-sm mt-2">{seedResult}</p>}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {greeting}, {name}.
        </h1>
        <p className="text-slate-600 text-lg">What are we studying today?</p>
      </div>

      <Link
        href="/chat"
        className="block w-full rounded-2xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition mb-8"
      >
        <div className="text-slate-400 text-sm">Type notes, ask a question, or upload material</div>
      </Link>

      {recentTopics.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Continue Learning
          </h2>
          <div className="grid gap-3">
            {recentTopics.map((t) => (
              <Link
                key={t.id}
                href={`/topic/${t.id}`}
                className="block rounded-xl bg-white border border-slate-200 p-4 hover:shadow-md transition"
              >
                <div className="font-semibold text-slate-800">
                  {t.subjectName}: {t.title}
                </div>
                <div className="text-sm text-slate-500">{t.subcategory || ""}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/library"
          className="block rounded-xl bg-white border border-slate-200 p-4 text-center hover:shadow-md transition"
        >
          <div className="font-semibold text-slate-800">Library</div>
          <div className="text-sm text-slate-500">{subjects.length} subjects</div>
        </Link>
        <Link
          href="/profile"
          className="block rounded-xl bg-white border border-slate-200 p-4 text-center hover:shadow-md transition"
        >
          <div className="font-semibold text-slate-800">Learning Profile</div>
          <div className="text-sm text-slate-500">Your progress</div>
        </Link>
      </div>
    </main>
  );
}
