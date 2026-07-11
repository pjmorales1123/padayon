"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { House } from "lucide-react";
import { buildAppHref } from "@/lib/navigation";

const SLIDES = [
  {
    title: "PADAYON",
    subtitle: "AI study partner built for Filipino students",
    body: (
      <div className="space-y-4">
        <p className="text-xl text-slate-600">
          Messy notes → organized, curriculum-aligned study packs in seconds.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          <Badge text="Gemma 4" color="purple" />
          <Badge text="AMD / Fireworks" color="red" />
          <Badge text="Agentic" color="blue" />
          <Badge text="Translanguaging" color="green" />
        </div>
      </div>
    ),
  },
  {
    title: "The Problem",
    subtitle: "Education chatbots are everywhere — but they don&apos;t fit the Philippines",
    body: (
      <ul className="text-left text-lg text-slate-700 space-y-3 max-w-2xl mx-auto">
        <li>Students take messy handwritten notes and never organize them.</li>
        <li>Most chatbots reply in English only, even when the student thinks in Cebuano or Filipino.</li>
        <li>Generic bots have no memory, no curriculum alignment, and no structured materials.</li>
        <li>Tutoring apps are expensive and don&apos;t scale to 28M+ Filipino learners.</li>
      </ul>
    ),
  },
  {
    title: "What PADAYON Does",
    subtitle: "Not just answers — a full learning workflow",
    body: (
      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto text-left">
        {[
          ["🧠", "Agent pipeline", "Classifier, curriculum, material creator, teacher & memory agents"],
          ["📸", "Photo to study pack", "Snap notes → clean notes, flashcards, quiz, summary, story"],
          ["🌐", "Translanguaging", "Cebuano/Filipino-first, then bridges to academic English"],
          ["🧬", "Adaptive memory", "Learns strengths, weaknesses, and style across chats"],
          ["📚", "DepEd-aligned", "Topics are matched to a seeded Grade 9 Budget of Work"],
          ["⚡", "Model router", "Gemma 4 toggle with automatic fallback to serverless models"],
        ].map(([icon, t, d]) => (
          <div key={t} className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="text-2xl mb-1">{icon}</div>
            <div className="font-bold text-slate-900">{t}</div>
            <div className="text-sm text-slate-600">{d}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Why PADAYON Wins",
    subtitle: "How we differ from generic education chatbots",
    body: (
      <div className="overflow-x-auto">
        <table className="w-full max-w-4xl mx-auto text-left text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-800">
              <th className="py-3 px-4 font-bold">Capability</th>
              <th className="py-3 px-4 font-bold">Generic Chatbot</th>
              <th className="py-3 px-4 font-bold text-blue-700">PADAYON</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Curriculum alignment", "None", "Mapped to DepEd Grade 9 competencies"],
              ["Language support", "English only", "Cebuano / Filipino / English with translanguaging"],
              ["Materials", "Text replies", "Flashcards, quizzes, reviewers, stories, clean notes"],
              ["Memory", "None", "Persistent learner profile that evolves"],
              ["Image input", "Rare / basic", "Handwritten notes → organized study pack"],
              ["Transparency", "Black box", "Live agent monitor shows every step"],
              ["Model choice", "Single model", "Gemma 4 + fallback to serverless"],
            ].map(([cap, gen, pad]) => (
              <tr key={cap} className="border-b border-slate-200">
                <td className="py-3 px-4 font-medium">{cap}</td>
                <td className="py-3 px-4 text-slate-500">{gen}</td>
                <td className="py-3 px-4 text-blue-700 font-medium">{pad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    title: "Tech Stack",
    subtitle: "Built for the AMD Developer Hackathon: ACT II",
    body: (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
        {[
          ["Next.js", "Frontend & API"],
          ["Supabase", "Postgres + auth"],
          ["Fireworks AI", "Gemma 4 on-demand + serverless fallback"],
          ["AMD Cloud", "GPU infrastructure option"],
          ["Tailwind", "UI"],
          ["Docker", "Containerized submission"],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl bg-slate-100 p-4">
            <div className="font-bold text-slate-900">{t}</div>
            <div className="text-xs text-slate-600">{d}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Live Demo",
    subtitle: "Open /demo to watch the agents work in real time",
    body: (
      <div className="space-y-4">
        <p className="text-slate-600">
          Chat on the left. Backend agent monitor on the right. Toggle Gemma 4 and see the pipeline classify, align, create, teach, and remember.
        </p>
        <Link
          href="/demo"
          className="inline-block rounded-2xl bg-blue-600 text-white px-8 py-4 text-lg font-bold hover:bg-blue-700 transition"
        >
          Launch Live Demo →
        </Link>
      </div>
    ),
  },
  {
    title: "Market & Vision",
    subtitle: "28M+ students in the Philippines need this",
    body: (
      <ul className="text-left text-lg text-slate-700 space-y-3 max-w-2xl mx-auto">
        <li>Primary market: 3.6M+ Grade 9–10 students in Philippine public schools.</li>
        <li>Expandable to any K–12 subject and any developing multilingual country.</li>
        <li>Freemium model: free study packs, premium tutoring and exam prep.</li>
        <li>Partnership path: DepEd Learning Management Systems, local ed-tech distributors.</li>
      </ul>
    ),
  },
  {
    title: "Thank You",
    subtitle: "PADAYON — keep learning going",
    body: (
      <div className="space-y-4">
        <p className="text-slate-600">Built for AMD Developer Hackathon: ACT II</p>
        <div className="flex justify-center gap-3">
          <Link href="/demo" className="rounded-xl bg-blue-600 text-white px-5 py-2 font-semibold hover:bg-blue-700">
            Live Demo
          </Link>
          <Link href="/chat" className="rounded-xl bg-white text-slate-700 border border-slate-300 px-5 py-2 font-semibold hover:bg-slate-50">
            Try Chat
          </Link>
        </div>
      </div>
    ),
  },
];

function Badge({ text, color }: { text: string; color: "purple" | "red" | "blue" | "green" }) {
  const colors = {
    purple: "bg-purple-100 text-purple-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-medium ${colors[color]}`}>{text}</span>
  );
}

function DeckInner() {
  const searchParams = useSearchParams();
  const userId = searchParams?.get("userId") || undefined;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        setIdx((i) => Math.min(i + 1, SLIDES.length - 1));
      } else if (e.key === "ArrowLeft") {
        setIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Home") {
        setIdx(0);
      } else if (e.key === "End") {
        setIdx(SLIDES.length - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const slide = SLIDES[idx];

  return (
    <main className="h-screen flex flex-col bg-slate-50 text-slate-900">
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="max-w-5xl w-full text-center space-y-6">
          <div className="text-sm font-bold uppercase tracking-widest text-slate-400">
            Slide {idx + 1} of {SLIDES.length}
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">{slide.title}</h1>
          <h2 className="text-xl sm:text-2xl text-slate-600 font-medium">{slide.subtitle}</h2>
          <div className="pt-4">{slide.body}</div>
        </div>
      </div>

      <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setIdx((i) => Math.max(i - 1, 0))}
            disabled={idx === 0}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            ← Prev
          </button>
          <button
            onClick={() => setIdx((i) => Math.min(i + 1, SLIDES.length - 1))}
            disabled={idx === SLIDES.length - 1}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Next →
          </button>
        </div>
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-2.5 h-2.5 rounded-full ${i === idx ? "bg-blue-600" : "bg-slate-300"}`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        <Link
          href={buildAppHref("/", userId)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          aria-label="Home"
        >
          <House className="h-4 w-4" />
          <span className="hidden sm:inline">Home</span>
        </Link>
      </div>
    </main>
  );
}

export default function Deck() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center text-slate-500">Loading deck...</div>}>
      <DeckInner />
    </Suspense>
  );
}
