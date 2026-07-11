"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildAppHref } from "@/lib/navigation";

const DEMO_USER_ID = "demo-user-id";

interface Topic {
  id: string;
  title: string;
  subcategory: string;
  last_studied_at: string;
  subjectName: string;
}

interface Profile {
  id: string;
  name: string;
}

const DEMO_PERSONAS = [
  { id: "demo-new-student", name: "Maria", tag: "Brand new" },
  { id: "demo-bisaya-learner", name: "Juan", tag: "Cebuano-first" },
  { id: "demo-english-advanced", name: "Alex", tag: "Advanced" },
  { id: "demo-struggling-student", name: "Bea", tag: "Needs support" },
];

const BASE_PROFILES = [
  { id: DEMO_USER_ID, name: "Demo Student" },
  ...DEMO_PERSONAS.map((p) => ({ id: p.id, name: `${p.name} · ${p.tag}` })),
];

export default function Home() {
  const router = useRouter();
  const [activeUserId, setActiveUserId] = useState(DEMO_USER_ID);
  const [name, setName] = useState("Student");
  const [recentTopics, setRecentTopics] = useState<Topic[]>([]);
  const [subjectCount, setSubjectCount] = useState(0);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [creating, setCreating] = useState(false);

  const loadData = () => {
    fetch(`/api/profile?userId=${activeUserId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.name) setName(d.user.name);
      })
      .catch(() => setName("Student"));

    fetch(`/api/library?userId=${activeUserId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.subjects) {
          setSubjectCount(d.subjects.length);
          const topics: Topic[] = d.subjects.flatMap((s: { name: string; topics?: Topic[] }) =>
            (s.topics || []).map((t) => ({ ...t, subjectName: s.name }))
          );
          topics.sort(
            (a, b) => new Date(b.last_studied_at).getTime() - new Date(a.last_studied_at).getTime()
          );
          setRecentTopics(topics.slice(0, 5));
        }
      })
      .catch(() => setRecentTopics([]));
  };

  useEffect(() => {
    // Load recently used local profiles from this browser
    const stored = typeof window !== "undefined" ? localStorage.getItem("padayon_profiles") : null;
    const localProfiles = stored ? (JSON.parse(stored) as Profile[]) : [];
    const merged = [...BASE_PROFILES, ...localProfiles.filter((p) => !BASE_PROFILES.some((b) => b.id === p.id))];
    setProfiles(merged);
  }, []);

  useEffect(() => {
    loadData();
  }, [activeUserId]);

  const createProfile = async () => {
    const newName = window.prompt("Enter the student's name:", "Student");
    if (!newName) return;
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const data = (await res.json()) as { userId?: string; error?: string };
      if (!res.ok || !data.userId) {
        window.alert(data.error || "Could not create profile.");
        return;
      }
      const updated = [...profiles, { id: data.userId, name: newName }];
      setProfiles(updated);
      localStorage.setItem("padayon_profiles", JSON.stringify(updated.slice(BASE_PROFILES.length)));
      setActiveUserId(data.userId);
      router.push(buildAppHref("/chat", data.userId));
    } catch {
      window.alert("Network error while creating profile.");
    } finally {
      setCreating(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <section className="max-w-5xl mx-auto px-4 pt-10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">PADAYON</h1>
            <p className="text-slate-500">AI study partner for Filipino students</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Student:</span>
            <select
              value={activeUserId}
              onChange={(e) => setActiveUserId(e.target.value)}
              className="text-sm rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={createProfile}
              disabled={creating}
              className="rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "..." : "New profile"}
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-8">
        <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {greeting}, {name}.
              </h2>
              <p className="text-slate-600 mb-6">
                Ready to study? PADAYON adapts to your level, explains in English, Filipino, or Cebuano, and builds flashcards, quizzes, and reviewers.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`${buildAppHref("/chat", activeUserId)}&new=1`}
                  className="rounded-xl bg-blue-600 text-white px-6 py-3 font-semibold hover:bg-blue-700 transition"
                >
                  Start studying →
                </Link>
                <Link
                  href={`${buildAppHref("/demo", activeUserId)}&new=1`}
                  className="rounded-xl bg-white text-slate-700 border border-slate-300 px-6 py-3 font-semibold hover:bg-slate-50 transition"
                >
                  See Live Demo
                </Link>
              </div>
            </div>

            <div className="w-full lg:w-80 shrink-0">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick stats</h3>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href={buildAppHref("/library", activeUserId)}
                  className="rounded-xl bg-slate-50 border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition"
                >
                  <div className="text-2xl font-bold text-slate-900">{subjectCount}</div>
                  <div className="text-xs text-slate-500">Subjects</div>
                </Link>
                <Link
                  href={buildAppHref("/library", activeUserId)}
                  className="rounded-xl bg-slate-50 border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition"
                >
                  <div className="text-2xl font-bold text-slate-900">{recentTopics.length}</div>
                  <div className="text-xs text-slate-500">Recent topics</div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Continue learning</h2>
          <Link
            href={buildAppHref("/library", activeUserId)}
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            Open library →
          </Link>
        </div>
        {recentTopics.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center">
            <p className="text-slate-500">No topics yet. Start studying to build your first study pack.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentTopics.map((t) => (
              <Link
                key={t.id}
                href={buildAppHref(`/topic/${t.id}`, activeUserId)}
                className="block rounded-2xl bg-white border border-slate-200 p-5 hover:shadow-md transition"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-1">{t.subjectName}</div>
                <div className="font-bold text-slate-900 mb-1">{t.title}</div>
                <div className="text-sm text-slate-500">{t.subcategory || ""}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-16">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Try a demo persona</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DEMO_PERSONAS.map((p) => (
            <Link
              key={p.id}
              href={buildAppHref("/demo", p.id)}
              className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-5 hover:shadow-lg transition"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">👤</span>
                <span className="font-bold">{p.name}</span>
              </div>
              <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium mb-2">
                {p.tag}
              </span>
              <p className="text-xs text-blue-50">Open {p.name}&apos;s live agent demo.</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
