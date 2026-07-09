"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export default function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [name, setName] = useState("");
  const [languageConfidence, setLanguageConfidence] = useState<Record<string, string>>({});
  const [learningStyle, setLearningStyle] = useState<Record<string, unknown>>({});
  const [strengths, setStrengths] = useState<string>("");
  const [weaknesses, setWeaknesses] = useState<string>("");
  const [studyHabits, setStudyHabits] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/profile?userId=${DEMO_USER_ID}`)
      .then((r) => r.json())
      .then((d) => {
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
      });
  }, []);

  const save = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          name,
          language_confidence: languageConfidence,
          learning_style: learningStyle,
          strengths: strengths.split("\n").map((s) => s.trim()).filter(Boolean),
          weaknesses: weaknesses.split("\n").map((s) => s.trim()).filter(Boolean),
          study_habits: studyHabits,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
        setSaved(true);
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setLoading(false);
    }
  };

  const displayName = user?.name || "Student";

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {displayName}&apos;s Learning Profile
        </h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Home
        </Link>
      </div>

      {saved && (
        <div className="mb-4 rounded-xl bg-green-100 text-green-800 px-4 py-3">
          Profile saved.
        </div>
      )}

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
              disabled={loading}
              className="rounded-xl bg-blue-600 text-white px-5 py-2 font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Profile"}
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

      <div className="mt-8 text-center text-slate-500 italic">
        PADAYON does not just answer. It grows with the learner.
      </div>
    </main>
  );
}
