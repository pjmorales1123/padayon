"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
}

interface Subject {
  id: string;
  name: string;
  topics: Topic[];
}

export default function Library() {
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    fetch(`/api/library?userId=${DEMO_USER_ID}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.subjects) setSubjects(d.subjects);
      });
  }, []);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Library</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Home
        </Link>
      </div>

      <div className="grid gap-4">
        {subjects.map((subject) => (
          <div key={subject.id} className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-800 mb-3">{subject.name}</h2>
            <div className="space-y-3">
              {(subject.topics || []).map((topic) => (
                <div key={topic.id} className="ml-4">
                  <div className="text-sm font-semibold text-slate-600 mb-1">
                    {topic.subcategory ? `${topic.subcategory} → ` : ""}
                    {topic.title}
                  </div>
                  <div className="ml-4 flex flex-wrap gap-2">
                    {(topic.materials || []).map((m) => (
                      <Link
                        key={m.id}
                        href={`/topic/${topic.id}`}
                        className="inline-block rounded-lg bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200 transition"
                      >
                        {m.title}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {subjects.length === 0 && (
          <div className="text-center text-slate-400 py-12">
            No subjects yet. Start studying in the chat!
          </div>
        )}
      </div>
    </main>
  );
}
