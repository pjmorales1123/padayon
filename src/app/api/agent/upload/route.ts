import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { callFireworksVision } from "@/lib/fireworks";
import { supabaseAdmin } from "@/lib/supabase";
import { startRun, logStep } from "@/lib/agent-events";

// Vision OCR can take a while for dense notes; give it the same headroom as the agent route.
export const maxDuration = 60;

const visionRuntime = {
  requested: "auto",
  provider: "fireworks",
  model: process.env.FIREWORKS_VISION_MODEL || "accounts/fireworks/models/kimi-k2p6",
  fallback: false,
};

function computeFileHash(dataUrl: string): string {
  return createHash("sha256").update(dataUrl).digest("hex");
}

function sanitizeOcrText(text: string): string {
  const firstCut = text
    .split(/\n(?:First line:|Then centered\/spanning:|In OCR for notes|I think the safest|The safest approach)/i)[0]
    .trim();

  const lines = firstCut
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(main content|no markdown|output format|example):?$/i.test(line))
    .filter((line) => !/^your task:/i.test(line))
    .filter((line) => !/^do not /i.test(line))
    .filter((line) => !/^preserve /i.test(line));

  return lines.join("\n").trim();
}

export async function POST(req: NextRequest) {
  let requestId: string | null = null;
  try {
    const formData = await req.formData();
    const userId = formData.get("userId") as string;
    const image = formData.get("image") as string;
    requestId = formData.get("requestId") as string | null;

    if (!userId || !image) {
      return NextResponse.json({ error: "Missing userId or image" }, { status: 400 });
    }

    if (!image.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
    }

    if (requestId) {
      startRun(requestId, userId, "Uploaded image notes");
      logStep(requestId, "start", "Received uploaded image for OCR", "done");
    }

    // Duplicate detection: skip model calls if this exact image was already processed.
    const fileHash = computeFileHash(image);
    const { data: existingAsset } = await supabaseAdmin!
      .from("uploaded_assets")
      .select("id, extracted_text, file_name, preview_url, topic_id")
      .eq("user_id", userId)
      .eq("file_hash", fileHash)
      .maybeSingle();

    if (existingAsset?.extracted_text) {
      if (requestId) {
        logStep(requestId, "retrieve", "Duplicate upload detected — skipping OCR", "done", { assetId: existingAsset.id });
      }
      return NextResponse.json({
        extractedText: existingAsset.extracted_text,
        previewSummary: existingAsset.extracted_text.trim().split("\n")[0].slice(0, 120),
        duplicate: true,
        requestId: requestId || undefined,
      });
    }

    if (requestId) {
      logStep(requestId, "retrieve", "Processing the uploaded picture", "running", { runtime: visionRuntime });
    }

    const prompt = `You are an OCR assistant for PADAYON, an AI learning partner for Filipino students.

Your task: read the image of student notes and extract every readable word. Preserve each distinct line of text as a separate numbered line. Do NOT describe the image. Do NOT explain what OCR is. Do NOT repeat these instructions.

Output format: a numbered list only. Example:
1. First line of notes
2. Second line of notes
3. Third line of notes

No markdown, no code fences, no explanations, no summaries.`;

    let extractedText = await callFireworksVision(image, prompt, 2000);

    // Guard against models that echo the prompt instead of extracting text.
    const looksLikePrompt =
      /OCR assistant|Extract all readable text|student notes|Return ONLY plain text|No markdown|preserve line breaks/i.test(
        extractedText || ""
      ) && !/[a-z]{3,}/i.test((extractedText || "").replace(/OCR assistant|Extract all readable text|student notes|Return ONLY plain text|No markdown|preserve line breaks/gi, ""));

    if (looksLikePrompt || !extractedText || extractedText.trim().length < 5) {
      console.warn("OCR returned prompt or empty text, retrying with alternate prompt. Raw:", extractedText?.slice(0, 200));
      const fallbackPrompt = "Transcribe all text visible in this image exactly as it appears. Output each distinct line as a numbered item (1. line, 2. line, ...). Output only the numbered transcription.";
      extractedText = await callFireworksVision(image, fallbackPrompt, 2000);
    }

    extractedText = sanitizeOcrText(extractedText || "");

    if (!extractedText || extractedText.trim().length < 5) {
      if (requestId) {
        logStep(requestId, "retrieve", "Could not read text from the image", "error", { runtime: visionRuntime });
      }
      return NextResponse.json(
        { error: "Could not read text from the image. Try a clearer photo." },
        { status: 422 }
      );
    }

    // Save the asset record so the same image is never OCR'd twice.
    const { error: insertError } = await supabaseAdmin!
      .from("uploaded_assets")
      .insert({
        user_id: userId,
        file_hash: fileHash,
        mime_type: image.split(";")[0].replace("data:", ""),
        asset_type: "image",
        preview_url: image,
        extracted_text: extractedText.trim(),
        processing_status: "processed",
      });
    if (insertError) {
      console.error("uploaded_assets insert error:", insertError);
    }

    if (requestId) {
      logStep(requestId, "retrieve", "Processed the uploaded picture", "done", {
        textLength: extractedText.trim().length,
        runtime: visionRuntime,
      });
    }

    return NextResponse.json({
      extractedText: extractedText.trim(),
      previewSummary: extractedText.trim().split("\n")[0].slice(0, 120),
      requestId: requestId || undefined,
    });
  } catch (err) {
    console.error("Upload OCR error:", err);
    if (requestId) {
      logStep(requestId, "retrieve", "Image processing failed", "error", { error: String(err), runtime: visionRuntime });
    }
    const message = err instanceof Error ? err.message : "Image processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
