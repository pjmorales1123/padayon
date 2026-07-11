"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import NextImage from "next/image";
import Link from "next/link";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import InteractiveMessage from "@/components/chat/InteractiveMessage";
import type { InteractivePayload, AgentResponseRuntime } from "@/lib/types";
import { consumeRequestId } from "./request-id";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  topicId?: string;
  materials?: string[];
  subject?: string;
  subcategory?: string;
  topic?: string;
  interactive?: InteractivePayload;
  imageUrl?: string;
}

const SUGGESTIONS = [
  "Explain photosynthesis like I'm 10",
  "Make flashcards for photosynthesis",
  "Quiz me on quadratic equations",
  "Tell me a story about cellular respiration",
  "Show me a visual for photosynthesis",
];

const MAX_UPLOAD_FILES = 10;
const MAX_UPLOAD_SIZE_MB = 12;
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
const SLOW_REQUEST_MS = 8000;

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function validateFiles(files: File[]): string | null {
  if (files.length > MAX_UPLOAD_FILES) {
    return `You can upload up to ${MAX_UPLOAD_FILES} files at once.`;
  }
  for (const file of files) {
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isImage && !isPdf) {
      return `"${file.name}" is not supported. Please upload images or PDFs only.`;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return `"${file.name}" is too large. Maximum file size is ${MAX_UPLOAD_SIZE_MB} MB.`;
    }
  }
  return null;
}

function runtimeBadgeLabel(runtime: AgentResponseRuntime | null): string | null {
  if (!runtime) return null;
  if (runtime.provider === "gemma" && !runtime.fallback) return "Gemma 4";
  if (runtime.provider === "fireworks" && !runtime.fallback) return "Auto · primary";
  return "Fallback · Fireworks";
}

function runtimeBadgeClass(runtime: AgentResponseRuntime | null): string {
  if (!runtime) return "";
  if (runtime.provider === "gemma" && !runtime.fallback) {
    return "bg-purple-100 text-purple-800 border-purple-200";
  }
  if (runtime.fallback) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-blue-100 text-blue-700 border-blue-200";
}

export interface ChatWorkspaceProps {
  userId: string;
  topicId?: string;
  initialModel?: "auto" | "gemma-4";
  initialPrompt?: string;
  autoSend?: boolean;
  initialRequestId?: string;
  embedded?: boolean;
  onRequestStart?: (requestId: string) => void;
  onRequestComplete?: (requestId: string) => void;
}

export default function ChatWorkspace({
  userId,
  topicId,
  initialModel = "auto",
  initialPrompt = "",
  autoSend = false,
  initialRequestId,
  embedded = false,
  onRequestStart,
  onRequestComplete,
}: ChatWorkspaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [requestState, setRequestState] = useState<"idle" | "working" | "slow" | "error">("idle");
  const [lastFailedPrompt, setLastFailedPrompt] = useState("");
  const [lastRuntime, setLastRuntime] = useState<AgentResponseRuntime | null>(null);
  const [stepLabel, setStepLabel] = useState("Thinking...");
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [model, setModel] = useState<"auto" | "gemma-4">(initialModel);
  const [modelStatus, setModelStatus] = useState<{ gemma3?: boolean; gemma4?: boolean }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("Student");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sendingRef = useRef(false);
  const autoSentRef = useRef(false);
  const inputRef = useRef(input);
  const initialRequestIdRef = useRef(initialRequestId);
  const slowTimerRef = useRef<NodeJS.Timeout | null>(null);

  const busy = requestState !== "idle" || uploading;

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setModelStatus({ gemma3: d.gemma3Configured, gemma4: d.gemma4Configured }))
      .catch(() => setModelStatus({}));
  }, []);

  useEffect(() => {
    fetch(`/api/profile?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.name) setUserName(d.user.name);
      })
      .catch(() => setUserName("Student"));
  }, [userId]);

  // Load conversation history for the selected topic (or all chats if no topic is selected).
  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      try {
        let history: ChatMessage[] = [];
        if (topicId) {
          const res = await fetch(`/api/topic/${topicId}?userId=${encodeURIComponent(userId)}`);
          const d = await res.json();
          history = (d.messages || []).map((m: { role: string; content: string; topic_id?: string | null }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            topicId: m.topic_id || undefined,
          }));
        } else {
          const res = await fetch(`/api/messages?userId=${encodeURIComponent(userId)}`);
          const d = await res.json();
          history = (d.messages || []).map((m: { role: string; content: string; topic_id?: string | null }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            topicId: m.topic_id || undefined,
          }));
        }
        if (!cancelled) setMessages(history);
      } catch {
        // History is optional; don't block the chat if it fails.
      }
    };
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [userId, topicId]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [messages, stepLabel, requestState]);

  function clearSlowTimer() {
    if (slowTimerRef.current) {
      clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
  }

  function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = Math.min(1, maxWidth / img.width);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas not supported"));
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const send = useCallback(async (textOverride?: string, imageUrlOverride?: string, skipUserMessage = false) => {
    const userMsg = (textOverride ?? inputRef.current).trim();
    if (!userMsg || sendingRef.current) return;
    sendingRef.current = true;
    setRequestState("working");
    setLastFailedPrompt("");
    setLastRuntime(null);

    const reqId = consumeRequestId(initialRequestIdRef.current, () => generateId("req"));
    initialRequestIdRef.current = undefined;
    onRequestStart?.(reqId);

    slowTimerRef.current = setTimeout(() => {
      setRequestState("slow");
    }, SLOW_REQUEST_MS);

    setInput("");
    if (!skipUserMessage) {
      setMessages((prev) => [...prev, { role: "user", content: userMsg, imageUrl: imageUrlOverride }]);
    }

    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/agent/run?requestId=${encodeURIComponent(reqId)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const lastEvent = data.run?.events?.[data.run.events.length - 1];
        if (lastEvent?.label) {
          setStepLabel(lastEvent.label);
        }
      } catch {
        // ignore polling errors
      }
    }, 500);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, message: userMsg, requestId: reqId, imageUrl: imageUrlOverride, model }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setLastRuntime(data.model_runtime || null);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "Done!",
          topicId: data.topic?.id,
          materials: data.materials_created,
          subject: data.classification?.subject,
          subcategory: data.classification?.subcategory,
          topic: data.classification?.topic,
          interactive: data.interactive,
        },
      ]);
      setRequestState("idle");
    } catch (err) {
      setInput(userMsg);
      setLastFailedPrompt(userMsg);
      setRequestState("error");
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
    } finally {
      clearSlowTimer();
      cancelled = true;
      clearInterval(interval);
      setStepLabel("Thinking...");
      sendingRef.current = false;
      onRequestComplete?.(reqId);
    }
  }, [userId, model, onRequestStart, onRequestComplete]);

  async function ocrImageDataUrl(dataUrl: string): Promise<string> {
    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("image", dataUrl);
    const uploadRes = await fetch("/api/agent/upload", { method: "POST", body: formData });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.extractedText) {
      throw new Error(uploadData.error || "Could not read image");
    }
    return uploadData.extractedText;
  }

  async function renderPdfPagesToImages(file: File): Promise<string[]> {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const images: string[] = [];
    const maxPages = Math.min(pdf.numPages, 6);

    for (let i = 1; i <= maxPages; i++) {
      setImportProgress({ current: i, total: maxPages, label: `Rendering PDF page ${i}/${maxPages}...` });
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      images.push(canvas.toDataURL("image/jpeg", 0.75));
    }

    return images;
  }

  function resetFileInput() {
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function showAssistantError(message: string) {
    setMessages((prev) => [...prev, { role: "assistant", content: message }]);
  }

  async function smartImportFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    const validationError = validateFiles(fileArray);
    if (validationError) {
      showAssistantError(validationError);
      resetFileInput();
      return;
    }

    const imageFiles = fileArray.filter((f) => f.type.startsWith("image/"));
    const pdfFiles = fileArray.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));

    if (imageFiles.length === 0 && pdfFiles.length === 0) {
      showAssistantError("Please upload images or PDF files.");
      resetFileInput();
      return;
    }

    setUploading(true);
    setImportProgress({ current: 0, total: imageFiles.length + pdfFiles.length * 3, label: "Preparing your notes..." });

    try {
      const allDataUrls: string[] = [];

      // Compress images
      for (let i = 0; i < imageFiles.length; i++) {
        setImportProgress({ current: i + 1, total: fileArray.length, label: `Compressing image ${i + 1}/${imageFiles.length}...` });
        const dataUrl = await compressImage(imageFiles[i], 1200, 0.7);
        allDataUrls.push(dataUrl);
      }

      // Render PDF pages to images
      for (const pdfFile of pdfFiles) {
        const pageImages = await renderPdfPagesToImages(pdfFile);
        allDataUrls.push(...pageImages);
      }

      if (allDataUrls.length === 0) {
        showAssistantError("Could not process any pages. Try clearer images or a text-based PDF.");
        return;
      }

      // OCR each image
      const extractedParts: string[] = [];
      for (let i = 0; i < allDataUrls.length; i++) {
        setImportProgress({ current: i + 1, total: allDataUrls.length, label: `Reading page ${i + 1}/${allDataUrls.length}...` });
        try {
          const text = await ocrImageDataUrl(allDataUrls[i]);
          if (text.trim().length > 5) extractedParts.push(text.trim());
        } catch (err) {
          console.warn("OCR failed for page", i, err);
        }
      }

      setImportProgress(null);
      setImagePreview(null);

      const combinedText = extractedParts.join("\n\n---\n\n").trim();
      if (!combinedText || combinedText.length < 20) {
        showAssistantError("Could not read enough text from these pages. Try taking clearer photos or typing the notes.");
        return;
      }

      // Show the first image as a preview in the user message
      const previewUrl = allDataUrls[0];
      const pageCount = allDataUrls.length;
      const summary = combinedText.split("\n").slice(0, 3).join(" ").slice(0, 140);
      const importLabel = pageCount > 1 ? `[Imported ${pageCount} pages]` : `[Imported 1 page]`;
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `${importLabel}\n${summary}${combinedText.length > 140 ? "..." : ""}`, imageUrl: previewUrl },
      ]);

      send(combinedText, previewUrl, true);
    } catch (err) {
      console.error("Smart import failed", err);
      showAssistantError("Import failed. Please try again with fewer or clearer pages.");
    } finally {
      setUploading(false);
      setImportProgress(null);
      setImagePreview(null);
      resetFileInput();
    }
  }

  async function uploadImageDataUrl(dataUrl: string) {
    setUploading(true);
    setImagePreview(dataUrl);

    try {
      const text = await ocrImageDataUrl(dataUrl);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `[Uploaded image]\n${text}`, imageUrl: dataUrl },
      ]);
      send(text, undefined, true);
    } catch (err) {
      console.error("Image upload failed", err);
      showAssistantError("Could not read the image. Try typing the notes instead.");
    } finally {
      setUploading(false);
      setImagePreview(null);
      resetFileInput();
    }
  }

  async function createNewProfile() {
    const name = window.prompt("Enter a name for the new student profile:", "Student");
    if (!name) return;
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok || !data.userId) {
        alert(data.error || "Could not create profile.");
        return;
      }
      window.location.href = `/chat?userId=${encodeURIComponent(data.userId)}`;
    } catch {
      alert("Network error while creating profile.");
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const validationError = validateFiles(fileArray);
    if (validationError) {
      showAssistantError(validationError);
      resetFileInput();
      return;
    }

    const first = files[0];
    if (files.length === 1 && first.type.startsWith("image/")) {
      // Legacy single-image path
      try {
        const dataUrl = await compressImage(first, 1200, 0.7);
        await uploadImageDataUrl(dataUrl);
      } catch {
        showAssistantError("Could not read the image. Please try again or type your notes.");
      }
      return;
    }

    await smartImportFiles(files);
  }

  async function openCamera() {
    setCameraOpen(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError("Camera access denied or not available. Try uploading a photo instead.");
    }
  }

  function closeCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraOpen(false);
    setCameraError(null);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    closeCamera();
    uploadImageDataUrl(dataUrl);
  }

  // Auto-send a demo prompt from the URL so screenshot / demo flows can trigger a real conversation.
  useEffect(() => {
    if (initialPrompt && autoSend && !autoSentRef.current && !sendingRef.current) {
      autoSentRef.current = true;
      send(initialPrompt);
    }
  }, [initialPrompt, autoSend, send]);

  const runtimeLabel = runtimeBadgeLabel(lastRuntime);
  const runtimeClass = runtimeBadgeClass(lastRuntime);

  return (
    <section aria-label="PADAYON chat workspace" className="flex flex-col h-full min-h-0">
      <main className="w-full h-full px-4 py-4 flex flex-col min-h-0">
        <header className="flex items-center justify-between mb-4 gap-3 bg-white/80 backdrop-blur rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 truncate">Study with PADAYON</h1>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-100">
                {userName}
              </span>
            </div>
            <p className="text-xs text-slate-500">AI learning partner for Filipino students</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {runtimeLabel && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${runtimeClass}`}
                title={`Model: ${lastRuntime?.model || "unknown"}`}
              >
                {runtimeLabel}
              </span>
            )}
            {model === "gemma-4" && (
              <span
                className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  modelStatus.gemma4 ? "bg-purple-100 text-purple-800" : "bg-amber-100 text-amber-800"
                }`}
                title={
                  modelStatus.gemma4
                    ? "Gemma 4 endpoint configured. On-demand deployment incurs hourly GPU cost while active."
                    : "Gemma 4 endpoint not configured — will fall back to serverless"
                }
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current"></span>
                </span>
                {modelStatus.gemma4 ? "Gemma 4 active" : "Fallback"}
              </span>
            )}
            <button
              onClick={createNewProfile}
              disabled={busy}
              className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="Create a fresh student profile for testing"
            >
              <span>＋</span>
              <span>New profile</span>
            </button>
            <label htmlFor="model-select" className="sr-only">Model</label>
            <select
              id="model-select"
              value={model}
              onChange={(e) => setModel(e.target.value as "auto" | "gemma-4")}
              disabled={busy}
              className="text-sm rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              title="Choose the AI model. Gemma 4 requires a configured endpoint and incurs hourly GPU cost while active."
            >
              <option value="auto">Auto (DeepSeek/Kimi)</option>
              <option value="gemma-4">Gemma 4 (demo only — paid)</option>
            </select>
          </div>
        </header>

        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-scroll space-y-4 mb-4 scroll-smooth">
          {messages.length === 0 && (
            <div className="text-center mt-10">
              {initialPrompt && (
                <div className="mb-6 rounded-2xl bg-purple-50 border border-purple-200 p-4 inline-block">
                  <p className="text-sm text-purple-900 mb-2">Demo prompt ready:</p>
                  <p className="text-sm font-medium text-purple-800 mb-3">“{initialPrompt}”</p>
                  <button
                    onClick={() => send(initialPrompt)}
                    disabled={busy}
                    className="rounded-xl bg-purple-600 text-white px-4 py-2 text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
                  >
                    Send prompt
                  </button>
                </div>
              )}
              <div className="inline-block rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-6 text-left mb-6">
                <h2 className="text-lg font-bold text-slate-900 mb-2">What can PADAYON do?</h2>
                <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                  <li>Explain topics in English, Filipino, or Cebuano</li>
                  <li>Auto-build flashcards, quizzes, reviewers & stories</li>
                  <li>Adapt to your learning style and pace</li>
                  <li>Organize everything in your personal library</li>
                </ul>
              </div>
              <p className="text-slate-500 text-sm mb-3">Try asking:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={busy}
                    className="rounded-full bg-white border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:border-blue-200 transition disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-2xl px-4 py-3 max-w-[85%] shadow-sm ${
                  m.role === "user"
                    ? "bg-blue-600 text-white whitespace-pre-wrap"
                    : "bg-white border border-slate-200 text-slate-800 relative group"
                }`}
              >
                {m.imageUrl && (
                  <NextImage
                    src={m.imageUrl}
                    alt="Uploaded note"
                    width={320}
                    height={192}
                    unoptimized
                    className="mb-2 rounded-xl max-h-48 object-cover border border-slate-200"
                  />
                )}
                {m.role === "user" ? (
                  m.content
                ) : (
                  <MarkdownRenderer>{m.content}</MarkdownRenderer>
                )}
                {m.interactive && m.topicId && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <InteractiveMessage payload={m.interactive} userId={userId} />
                  </div>
                )}
                {m.subject && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {m.subject}
                    </span>
                    {m.subcategory && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {m.subcategory}
                      </span>
                    )}
                  </div>
                )}
                {m.topicId && m.materials && m.materials.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">Created for you:</p>
                    <Link
                      href={`/topic/${m.topicId}?userId=${userId}`}
                      className="text-sm text-blue-600 hover:underline font-medium"
                    >
                      View study pack →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
          {requestState === "working" && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 max-w-[85%] shadow-sm">
                <div className="flex items-center gap-3 text-slate-600">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-sm font-medium">PADAYON is thinking...</span>
                </div>
              </div>
            </div>
          )}
          {requestState === "slow" && (
            <div className="flex justify-start">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 max-w-[85%] shadow-sm">
                <div className="flex items-start gap-3 text-amber-800">
                  <span className="shrink-0 text-lg">⏳</span>
                  <div>
                    <p className="text-sm font-medium">Still working through your study pack.</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      You can watch each step in the learning trail.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {requestState === "error" && (
            <div className="flex justify-start">
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 max-w-[85%] shadow-sm">
                <div className="flex items-start gap-3 text-red-800">
                  <span className="shrink-0 text-lg">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Request failed</p>
                    {lastFailedPrompt && (
                      <button
                        onClick={() => send(lastFailedPrompt)}
                        disabled={busy}
                        className="mt-2 inline-flex items-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {(imagePreview || importProgress) && (
          <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 flex items-center gap-3">
            {imagePreview && (
              <NextImage
                src={imagePreview}
                alt="Uploading"
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 object-cover rounded-lg border border-slate-200"
              />
            )}
            <div className="text-sm text-blue-800 flex-1">
              <p className="font-medium">
                {importProgress ? importProgress.label : "Reading your notes..."}
              </p>
              {importProgress && (
                <p className="text-xs text-blue-600">
                  Page {importProgress.current} of {importProgress.total}
                </p>
              )}
              {!importProgress && <p className="text-xs text-blue-600">This may take a few seconds.</p>}
            </div>
            {uploading && <div className="ml-auto w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />}
          </div>
        )}

        {cameraOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">Snap a photo of your notes</h3>
                <button onClick={closeCamera} className="text-slate-500 hover:text-slate-800" aria-label="Close camera">
                  ✕
                </button>
              </div>
              {cameraError ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 mb-3">
                  {cameraError}
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] mb-3">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  {!cameraStream && (
                    <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                      Starting camera...
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Choose file
                </button>
                <button
                  onClick={capturePhoto}
                  disabled={!cameraStream}
                  className="flex-1 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Capture
                </button>
              </div>
            </div>
          </div>
        )}

        {requestState === "error" && lastFailedPrompt && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-red-800">Could not send your message</p>
              <p className="text-xs text-red-600 truncate">“{lastFailedPrompt}”</p>
            </div>
            <button
              onClick={() => send(lastFailedPrompt)}
              disabled={busy}
              className="shrink-0 rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        )}

        <div className="w-full flex justify-center px-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,application/pdf"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="w-full flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-400">
            <button
              onClick={openCamera}
              disabled={busy}
              className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 transition"
              aria-label="Open camera"
              title="Open camera"
            >
              📷
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 transition"
              aria-label="Upload notes or PDF"
              title="Upload photos or PDF"
            >
              📎
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask anything, type notes, or upload photos/PDF..."
              className="flex-1 bg-transparent px-2 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              onClick={() => send()}
              disabled={busy || !input.trim()}
              className="rounded-xl bg-blue-600 text-white px-4 py-2.5 font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:bg-slate-300 transition"
            >
              Send
            </button>
          </div>
        </div>
      </main>
    </section>
  );
}
