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

Extract all readable text from this image of student notes. Preserve line breaks and formatting as much as possible.

Then add a brief summary (1-2 sentences) of what subject and topic the notes are about.

Return ONLY plain text. No markdown, no code fences, no explanations.`;

    const extractedText = await callFireworksVision(image, prompt, 1200);

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
