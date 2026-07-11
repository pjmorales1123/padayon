"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ChatWorkspace from "@/features/chat/ChatWorkspace";

const DEMO_USER_ID = "demo-user-id";

function ChatQueryAdapter() {
  const searchParams = useSearchParams();
  const userId = searchParams?.get("userId") || DEMO_USER_ID;
  const modelParam = searchParams?.get("model") as "auto" | "gemma-4" | null;
  const initialModel = ["auto", "gemma-4"].includes(modelParam || "")
    ? (modelParam as "auto" | "gemma-4")
    : "auto";
  const initialPrompt = searchParams?.get("prompt") || undefined;
  const autoSend = searchParams?.get("autoSend") === "1";
  const initialRequestId = searchParams?.get("requestId") || undefined;

  return (
    <ChatWorkspace
      userId={userId}
      initialModel={initialModel}
      initialPrompt={initialPrompt}
      autoSend={autoSend}
      initialRequestId={initialRequestId}
    />
  );
}

export default function Chat() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading chat...</div>}>
      <ChatQueryAdapter />
    </Suspense>
  );
}
