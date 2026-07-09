"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const DEMO_USER_ID = "demo-user-id";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  topicId?: string;
  materials?: string[];
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  const loadingText = [
    "Understanding your notes...",
    "Organizing into your learning library...",
    "Creating your study pack...",
    "Updating your learning profile...",
  ][tick % 4];

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: DEMO_USER_ID, message: userMsg }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "Done!",
          topicId: data.topic?.id,
          materials: data.materials_created,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-4 flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Study with PADAYON</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Home
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 mt-12">
            <p className="mb-2">Try typing:</p>
            <p className="text-sm italic">
              photosynthesis chlorophyll sunlight CO2 oxygen glucose food important
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-2xl px-4 py-3 max-w-[85%] whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-blue-600 text-white self-end ml-auto"
                : "bg-white border border-slate-200 text-slate-800 self-start"
            }`}
          >
            {m.content}
            {m.topicId && m.materials && m.materials.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Created for you:</p>
                <Link
                  href={`/topic/${m.topicId}`}
                  className="text-sm text-blue-600 hover:underline font-medium"
                >
                  View study pack →
                </Link>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 max-w-[85%] self-start">
            <div className="flex items-center gap-2 text-slate-600">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              {loadingText}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type notes, ask a question..."
          className="flex-1 rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <button
          onClick={send}
          disabled={loading}
          className="rounded-xl bg-blue-600 text-white px-5 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </main>
  );
}
