"use client";

import { useEffect, useRef, useState } from "react";

interface LearnerSummaryProps {
  userId: string;
  refreshKey: number;
}

interface ProfileData {
  user?: { name?: string | null };
  profile?: {
    language_confidence?: Record<string, string> | null;
    learning_style?: Record<string, boolean> | null;
    strengths?: string[] | null;
    weaknesses?: string[] | null;
    updated_at?: string | null;
  } | null;
}

interface Topic {
  id: string;
  title: string;
  subcategory: string | null;
  progress?: Record<string, unknown> | null;
  last_studied_at?: string | null;
  materials?: Array<{ type: string; title: string; created_at?: string | null }> | null;
}

interface Subject {
  id: string;
  name: string;
  topics?: Topic[] | null;
}

interface LibraryData {
  subjects?: Subject[] | null;
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

export default function LearnerSummary({ userId, refreshKey }: LearnerSummaryProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const hasDataRef = useRef(false);

  // Auto-refresh the summary every 8 seconds so it stays in sync with the agent
  // without the user needing to manually refresh the page.
  useEffect(() => {
    const interval = setInterval(() => {
      setRetryCount((c) => c + 1);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Only show the skeleton on the first load; background polls keep old data visible.
      if (!hasDataRef.current) {
        setLoading(true);
      }
      setError(null);
      try {
        const [profileRes, libraryRes] = await Promise.all([
          fetch(`/api/profile?userId=${encodeURIComponent(userId)}`),
          fetch(`/api/library?userId=${encodeURIComponent(userId)}`),
        ]);

        if (!profileRes.ok) {
          const data = (await profileRes.json()) as { error?: string };
          throw new Error(data.error || "Could not load profile");
        }
        if (!libraryRes.ok) {
          const data = (await libraryRes.json()) as { error?: string };
          throw new Error(data.error || "Could not load library");
        }

        const profileData = (await profileRes.json()) as ProfileData;
        const libraryData = (await libraryRes.json()) as LibraryData;

        if (!cancelled) {
          setProfile(profileData);
          setLibrary(libraryData);
          hasDataRef.current = true;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey, retryCount]);

  if (loading) {
    return (
      <div className="h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <SkeletonBlock className="mb-4 h-6 w-3/4" />
        <SkeletonBlock className="mb-3 h-4 w-1/2" />
        <SkeletonBlock className="mb-3 h-4 w-2/3" />
        <SkeletonBlock className="h-4 w-1/3" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col justify-center rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
        <p className="text-sm font-medium text-red-800">{error}</p>
        <button
          onClick={() => setRetryCount((c) => c + 1)}
          className="mt-3 inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const name = profile?.user?.name || userId;
  const languageConfidence = profile?.profile?.language_confidence;
  const language = languageConfidence
    ? Object.entries(languageConfidence)
        .map(([lang, level]) => `${lang}: ${level}`)
        .join(", ")
    : "Not set";

  const learningStyleMap = profile?.profile?.learning_style;
  const learningStyle = learningStyleMap
    ? Object.entries(learningStyleMap)
        .filter(([, enabled]) => enabled)
        .map(([style]) => style.replace(/_/g, " "))
        .join(", ") || "Not set"
    : "Not set";

  const allTopics = (library?.subjects || []).flatMap((s) => (s.topics || []).map((t) => ({ ...t, subjectName: s.name })));
  const topicCount = allTopics.length;

  const recentActivity = allTopics
    .flatMap((t) => {
      const events: Array<{ ts: string; text: string }> = [];
      if (t.last_studied_at) {
        const confidence = typeof t.progress?.confidence === "number" ? t.progress.confidence : 0;
        const status = (t.progress?.status as string) || "started";
        events.push({
          ts: t.last_studied_at,
          text: `Studied ${t.subjectName} → ${t.subcategory || "General"} → ${t.title} · ${confidence}% ${status}`,
        });
      }
      (t.materials || []).forEach((m) => {
        const folder = `${t.subjectName} → ${t.subcategory || "General"} → ${t.title}`;
        let text = `Saved ${m.type.replace(/_/g, " ")} on ${folder}`;
        if (m.type === "image_notes") {
          text = "Placed one picture on your library and saved the contents.";
        } else if (m.type === "pdf_notes") {
          text = "Placed one PDF on your library and saved the contents.";
        } else if (m.type === "clean_notes") {
          text = `Saved transcribed notes on ${folder}`;
        } else if (m.type === "original_notes") {
          text = `Imported original notes on ${folder}`;
        }
        events.push({
          ts: m.created_at || t.last_studied_at || new Date().toISOString(),
          text,
        });
      });
      return events;
    })
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 10);

  const hasHistory = topicCount > 0 || recentActivity.length > 0;

  return (
    <div className="h-full min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-slate-900">{name}</h2>
      <p className="mb-4 text-xs text-slate-500">Learner summary</p>

      <dl className="space-y-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Language</dt>
          <dd className="text-sm text-slate-800">{language}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Learning style</dt>
          <dd className="text-sm text-slate-800">{learningStyle}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Topics studied</dt>
          <dd className="text-sm text-slate-800">{topicCount}</dd>
        </div>
        {profile?.profile?.strengths && profile.profile.strengths.length > 0 && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Strengths</dt>
            <dd className="text-sm text-slate-800">{profile.profile.strengths.join(", ")}</dd>
          </div>
        )}
        {profile?.profile?.weaknesses && profile.profile.weaknesses.length > 0 && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Growth areas</dt>
            <dd className="text-sm text-slate-800">{profile.profile.weaknesses.join(", ")}</dd>
          </div>
        )}
      </dl>

      {recentActivity.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent activity</h3>
          <ul className="space-y-2">
            {recentActivity.map((a, i) => (
              <li key={i} className="text-xs text-slate-700 border-l-2 border-blue-200 pl-2">
                {a.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasHistory && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-medium text-blue-900">No learning history yet.</p>
          <p className="text-xs text-blue-700">Send a judge prompt to build the first study pack.</p>
        </div>
      )}
    </div>
  );
}
