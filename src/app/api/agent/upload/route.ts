import { NextRequest, NextResponse } from "next/server";
import { callFireworksVision } from "@/lib/fireworks";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const userId = formData.get("userId") as string;
    const image = formData.get("image") as string;

    if (!userId || !image) {
      return NextResponse.json({ error: "Missing userId or image" }, { status: 400 });
    }

    if (!image.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
    }

    const prompt = `You are an OCR assistant for PADAYON, an AI learning partner for Filipino students.

Your task: read the image of student notes and extract every readable word. Preserve line breaks and formatting. Do NOT describe the image. Do NOT explain what OCR is. Do NOT repeat these instructions.

Output format: plain text only. No markdown, no code fences, no explanations, no summaries.`;

    let extractedText = await callFireworksVision(image, prompt, 1200);

    // Guard against models that echo the prompt instead of extracting text.
    const looksLikePrompt =
      /OCR assistant|Extract all readable text|student notes|Return ONLY plain text|No markdown|preserve line breaks/i.test(
        extractedText || ""
      ) && !/[a-z]{3,}/i.test((extractedText || "").replace(/OCR assistant|Extract all readable text|student notes|Return ONLY plain text|No markdown|preserve line breaks/gi, ""));

    if (looksLikePrompt || !extractedText || extractedText.trim().length < 5) {
      console.warn("OCR returned prompt or empty text, retrying with alternate prompt. Raw:", extractedText?.slice(0, 200));
      const fallbackPrompt = "Transcribe all text visible in this image exactly as it appears. Output only the transcription.";
      extractedText = await callFireworksVision(image, fallbackPrompt, 1200);
    }

    if (!extractedText || extractedText.trim().length < 5) {
      return NextResponse.json(
        { error: "Could not read text from the image. Try a clearer photo." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      extractedText: extractedText.trim(),
      previewSummary: extractedText.trim().split("\n")[0].slice(0, 120),
    });
  } catch (err) {
    console.error("Upload OCR error:", err);
    const message = err instanceof Error ? err.message : "Image processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
