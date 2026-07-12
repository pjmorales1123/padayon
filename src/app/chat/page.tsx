"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ChatWorkspace from "@/features/chat/ChatWorkspace";
import { buildAppHref } from "@/lib/navigation";

const DEMO_USER_ID = "demo-user-id";

interface Topic {
  id: string;
  title: string;
  subcategory: string | null;
  last_studied_at: string;
  subjectName: string;
}

function ChatPageInner() {
  const searchParams = useSearchParams();
  const userId = searchParams?.get("userId") || DEMO_USER_ID;
  const modelParam = searchParams?.get("model") as "fallback" | "gemma-4" | null;
  const validModels = ["fallback", "gemma-4"];
  const initialModel = validModels.includes(modelParam || "")
    ? (modelParam as "fallback" | "gemma-4")
    : "gemma-4";
  const initialPrompt = searchParams?.get("prompt") || undefined;
  const autoSend = searchParams?.get("autoSend") === "1";
  const initialRequestId = searchParams?.get("requestId") || undefined;
  const startFresh = searchParams?.get("new") === "1";

  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [loadingTopics, setLoadingTopics] = useState(true);

  useEffect(() => {
    fetch(`/api/library?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        const allTopics: Topic[] = (d.subjects || []).flatMap(
          (s: { name: string; topics?: Topic[] }) =>
            (s.topics || []).map((t) => ({ ...t, subjectName: s.name }))
        );
        allTopics.sort(
          (a, b) =>
            new Date(b.last_studied_at).getTime() -
            new Date(a.last_studied_at).getTime()
        );
        setTopics(allTopics);
        if (allTopics.length > 0 && !selectedTopicId) {
          setSelectedTopicId(allTopics[0].id);
        }
      })
      .catch(() => setTopics([]))
      .finally(() => setLoadingTopics(false));
  }, [userId]);

  return (
    <main className="h-[calc(100vh-4rem)] max-w-6xl mx-auto px-4 py-4 flex gap-4">
      <aside className="hidden sm:flex flex-col w-64 shrink-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-900">Chat history</h2>
          <p className="text-xs text-slate-500">Pick a topic to review</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingTopics && (
            <div className="p-2 text-xs text-slate-400">Loading topics...</div>
          )}
          {!loadingTopics && topics.length === 0 && (
            <div className="p-2 text-xs text-slate-400">
              No topics yet. Start chatting to create one.
            </div>
          )}
          <button
            onClick={() => setSelectedTopicId(null)}
            className={`w-full text-left rounded-xl px-3 py-2 text-sm transition ${
              selectedTopicId === null
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            All chats
          </button>
          {topics.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTopicId(t.id)}
              className={`w-full text-left rounded-xl px-3 py-2 text-sm transition ${
                selectedTopicId === t.id
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="truncate">{t.title}</div>
              <div className="text-[10px] text-slate-500 truncate">
                {t.subjectName} · {t.subcategory || "General"}
              </div>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-slate-200">
          <Link
            href={buildAppHref("/library", userId)}
            className="block text-center text-xs font-semibold text-blue-600 hover:underline"
          >
            Open library →
          </Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <ChatWorkspace
          userId={userId}
          topicId={selectedTopicId || undefined}
          initialModel={initialModel}
          initialPrompt={initialPrompt}
          autoSend={autoSend}
          initialRequestId={initialRequestId}
          startFresh={startFresh}
        />
      </div>
    </main>
  );
}

export default function Chat() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading chat...</div>}>
      <ChatPageInner />
    </Suspense>
  );
}
