"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppNavigation from "@/components/navigation/AppNavigation";

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
  const [seedingPersonas, setSeedingPersonas] = useState(false);
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

  const seedPersonas = async () => {
    setSeedingPersonas(true);
    try {
      await fetch("/api/seed-personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
    } finally {
      setSeedingPersonas(false);
    }
  };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <main className="min-h-screen bg-slate-50">
      {health && !health.ready && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-900 max-w-3xl mx-auto mt-4 mx-4">
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

      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <AppNavigation userId={DEMO_USER_ID} />
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-12 pb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-800 px-4 py-1.5 text-sm font-medium mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
          </span>
          AMD Developer Hackathon: ACT II — Gemma 4 learning partner
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
          PADAYON
        </h1>
        <p className="text-xl sm:text-2xl text-slate-600 mb-4 max-w-2xl mx-auto">
          An AI study partner that turns messy notes into organized, curriculum-aligned learning materials.
        </p>
        <p className="text-slate-500 mb-8 max-w-xl mx-auto">
          For Filipino students who struggle with academic English, disorganized notes, and boring review sessions.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/demo"
            className="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 text-lg font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition"
          >
            See the live demo
          </Link>
          <Link
            href="/chat"
            className="w-full sm:w-auto rounded-2xl bg-white text-slate-700 border border-slate-300 px-8 py-4 text-lg font-semibold hover:bg-slate-50 transition"
          >
            Try the chat
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: "🧠", title: "Agent pipeline", body: "Classifier, curriculum, material creator, teacher & memory agents work together." },
            { icon: "📸", title: "Smart import", body: "Upload photos or a lesson PDF and get clean flashcards, quizzes, summaries & stories." },
            { icon: "🌐", title: "Translanguaging", body: "Explains in Cebuano or Filipino first, then bridges to academic English." },
            { icon: "📊", title: "Adaptive memory", body: "Learns your strengths, weaknesses, and style across every conversation." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl bg-white border border-slate-200 p-5 hover:shadow-md transition">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-slate-900 mb-1">{f.title}</h3>
              <p className="text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Demo personas */}
      <section className="max-w-5xl mx-auto px-4 pb-10">
        <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-6 sm:p-10 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">Demo personas</h2>
              <p className="text-blue-100 text-sm">
                See how PADAYON adapts when it already knows the student.
              </p>
            </div>
            <button
              onClick={seedPersonas}
              disabled={seedingPersonas}
              className="rounded-xl bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 transition"
            >
              {seedingPersonas ? "Preparing..." : "Reset personas"}
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { id: "demo-new-student", name: "Maria", tag: "Brand new", desc: "No history. PADAYON starts fresh and explains in simple terms.", color: "bg-white/10" },
              { id: "demo-bisaya-learner", name: "Juan", tag: "Cebuano-first", desc: "Strong in Cebuano, growing in English. Already studied Photosynthesis.", color: "bg-amber-400/20" },
              { id: "demo-english-advanced", name: "Alex", tag: "Advanced", desc: "High English confidence. Already studied Irony, ready for deeper analysis.", color: "bg-emerald-400/20" },
              { id: "demo-struggling-student", name: "Bea", tag: "Needs support", desc: "Gets discouraged easily. Already tried Quadratic Equations once.", color: "bg-rose-400/20" },
            ].map((p) => (
              <Link
                key={p.id}
                href={`/demo?userId=${p.id}`}
                className={`block rounded-2xl ${p.color} border border-white/10 p-4 hover:bg-white/20 transition`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">👤</span>
                  <span className="font-bold">{p.name}</span>
                </div>
                <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium mb-2">
                  {p.tag}
                </span>
                <p className="text-xs text-blue-50 leading-relaxed">{p.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Demo preview / continue */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-10 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                {greeting}, {name}.
              </h2>
              <p className="text-slate-600 mb-6">
                Open the <strong>Live Demo</strong> to watch the agent pipeline classify your message, align it to the curriculum, and build a study pack in real time.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/demo"
                  className="rounded-xl bg-blue-600 text-white px-5 py-3 font-semibold hover:bg-blue-700 transition"
                >
                  Open Live Demo →
                </Link>
                <Link
                  href="/chat"
                  className="rounded-xl bg-white text-slate-700 border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-50 transition"
                >
                  Start chatting
                </Link>
              </div>
            </div>

            <div className="w-full lg:w-72 shrink-0">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Continue Learning
              </h3>
              {recentTopics.length === 0 ? (
                <p className="text-sm text-slate-500">No topics yet. Try the demo or chat to create one.</p>
              ) : (
                <div className="space-y-3">
                  {recentTopics.map((t) => (
                    <Link
                      key={t.id}
                      href={`/topic/${t.id}`}
                      className="block rounded-xl bg-slate-50 border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition"
                    >
                      <div className="font-semibold text-slate-800">
                        {t.subjectName}: {t.title}
                      </div>
                      <div className="text-sm text-slate-500">{t.subcategory || ""}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 max-w-2xl mx-auto">
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
            <div className="font-semibold text-slate-800">Profile</div>
            <div className="text-sm text-slate-500">Your progress</div>
          </Link>
          <Link
            href="/demo"
            className="block rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white border border-blue-600 p-4 text-center hover:shadow-md transition"
          >
            <div className="font-semibold">Live Demo</div>
            <div className="text-sm text-blue-100">See agents work</div>
          </Link>
        </div>
      </section>
    </main>
  );
}
