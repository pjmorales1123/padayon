"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const DEMO_USER_ID = "demo-user-id";

interface User {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  user_id: string;
  language_confidence: Record<string, string>;
  learning_style: Record<string, unknown>;
  strengths: string[];
  weaknesses: string[];
  study_habits: Record<string, string>;
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

function ProfileInner() {
  const searchParams = useSearchParams();
  const userId = searchParams?.get("userId") || DEMO_USER_ID;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [name, setName] = useState("");
  const [languageConfidence, setLanguageConfidence] = useState<Record<string, string>>({});
  const [learningStyle, setLearningStyle] = useState<Record<string, unknown>>({});
  const [strengths, setStrengths] = useState<string>("");
  const [weaknesses, setWeaknesses] = useState<string>("");
  const [studyHabits, setStudyHabits] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profile?userId=${userId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `Could not load profile (${r.status})`);
        return data;
      })
      .then((d) => {
        if (cancelled) return;
        setProfile(d.profile);
        setUser(d.user);
        if (d.user?.name) setName(d.user.name);
        if (d.profile) {
          setLanguageConfidence(d.profile.language_confidence || {});
          setLearningStyle(d.profile.learning_style || {});
          setStrengths((d.profile.strengths || []).join("\n"));
          setWeaknesses((d.profile.weaknesses || []).join("\n"));
          setStudyHabits(d.profile.study_habits || {});
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load profile");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, retryCount]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          name,
          language_confidence: languageConfidence,
          learning_style: learningStyle,
          strengths: strengths.split("\n").map((s) => s.trim()).filter(Boolean),
          weaknesses: weaknesses.split("\n").map((s) => s.trim()).filter(Boolean),
          study_habits: studyHabits,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSaveError(data.error || `Save failed (${res.status})`);
        return;
      }
      setProfile(data.profile);
      setSaved(true);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const displayName = user?.name || "Student";

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {displayName}&apos;s Learning Profile
        </h1>
      </div>

      {saveError && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {saveError}
        </div>
      )}

      {saved && (
        <div className="mb-4 rounded-xl bg-green-100 text-green-800 px-4 py-3">
          Profile saved.
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <SkeletonBlock className="h-24 w-full" />
          <SkeletonBlock className="h-32 w-full" />
          <SkeletonBlock className="h-32 w-full" />
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
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                Name
              </h2>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
            {isEditing ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Your name"
              />
            ) : (
              <p className="text-slate-800">{displayName}</p>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Language Confidence
            </h2>
            {isEditing ? (
              <div className="space-y-2">
                {Object.entries(languageConfidence).map(([lang, level]) => (
                  <div key={lang} className="flex gap-2">
                    <input
                      value={lang}
                      readOnly
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 bg-slate-50"
                    />
                    <select
                      value={level}
                      onChange={(e) =>
                        setLanguageConfidence((prev) => ({ ...prev, [lang]: e.target.value }))
                      }
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                    >
                      <option>High</option>
                      <option>Medium</option>
                      <option>Developing</option>
                    </select>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {profile?.language_confidence ?
                  Object.entries(profile.language_confidence).map(([lang, level]) => (
                    <div key={lang} className="flex justify-between">
                      <span className="text-slate-800">{lang}</span>
                      <span className="text-slate-600">{level}</span>
                    </div>
                  )) : (
                  <div className="text-slate-400">No language data yet.</div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Learning Style
            </h2>
            {isEditing ? (
              <textarea
                value={Object.entries(learningStyle)
                  .map(([k, v]) => `${k}: ${v === true ? "yes" : v}`)
                  .join("\n")}
                onChange={(e) => {
                  const obj: Record<string, unknown> = {};
                  e.target.value.split("\n").forEach((line) => {
                    const [k, v] = line.split(":").map((s) => s.trim());
                    if (k) obj[k] = v === "yes" ? true : v || true;
                  });
                  setLearningStyle(obj);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                rows={4}
                placeholder="one per line, e.g. visuals: yes"
              />
            ) : (
              <div className="space-y-2">
                {profile?.learning_style ?
                  Object.entries(profile.learning_style).map(([style, val]) => (
                    <div key={style} className="text-slate-800">
                      {style} {val === true ? "" : `: ${String(val)}`}
                    </div>
                  )) : (
                  <div className="text-slate-400">No learning style data yet.</div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Strengths
            </h2>
            {isEditing ? (
              <textarea
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                rows={3}
                placeholder="One strength per line"
              />
            ) : (
              <ul className="list-disc list-inside text-slate-800 space-y-1">
                {(profile?.strengths || []).length === 0 && (
                  <li className="text-slate-400 list-none">No strengths recorded yet.</li>
                )}
                {profile?.strengths?.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Weaknesses
            </h2>
            {isEditing ? (
              <textarea
                value={weaknesses}
                onChange={(e) => setWeaknesses(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                rows={3}
                placeholder="One weakness per line"
              />
            ) : (
              <ul className="list-disc list-inside text-slate-800 space-y-1">
                {(profile?.weaknesses || []).length === 0 && (
                  <li className="text-slate-400 list-none">No weaknesses recorded yet.</li>
                )}
                {profile?.weaknesses?.map((w: string, i: number) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>

          {isEditing && (
            <div className="flex gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-xl bg-blue-600 text-white px-5 py-2 font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="rounded-xl bg-white border border-slate-300 text-slate-700 px-5 py-2 font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 text-center text-slate-500 italic">
        PADAYON does not just answer. It grows with the learner.
      </div>
    </main>
  );
}

export default function Profile() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading profile...</div>}>
      <ProfileInner />
    </Suspense>
  );
}
