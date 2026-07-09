import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { memoryAgent } from "@/lib/agents";

export async function POST(req: NextRequest) {
  try {
    const { userId, topicId, score, total, answers } = await req.json();

    if (!userId || !topicId || typeof score !== "number" || typeof total !== "number") {
      return NextResponse.json({ error: "Missing userId, topicId, score, or total" }, { status: 400 });
    }

    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = percentage >= 70;

    // Update topic progress
    const { data: topic } = await supabaseAdmin!
      .from("topics")
      .select("id, title, progress")
      .eq("id", topicId)
      .single();

    const previousProgress = (topic?.progress || {}) as Record<string, unknown>;
    const attempts = (previousProgress.quiz_attempts as number | undefined || 0) + 1;
    const bestScore = Math.max(previousProgress.best_score as number | undefined || 0, percentage);

    const newProgress = {
      ...previousProgress,
      quiz_attempts: attempts,
      last_score: percentage,
      best_score: bestScore,
      passed,
      last_answers: answers || [],
      updated_at: new Date().toISOString(),
    };

    const { error: progressErr } = await supabaseAdmin!
      .from("topics")
      .update({ progress: newProgress })
      .eq("id", topicId);

    if (progressErr) throw progressErr;

    // Update memory with actual quiz result
    const { data: existingProfile } = await supabaseAdmin!
      .from("learner_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    const memoryUpdate = await memoryAgent(
      `Quiz submitted for ${topic?.title || "topic"}. Score: ${score}/${total} (${percentage}%).`,
      { correct: passed, topic: topic?.title || "Unknown" },
      existingProfile || {}
    );

    // Merge memory update into profile
    const lsUpdate = memoryUpdate.learning_style_update || "";
    const lsEntries = lsUpdate
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => [s, true]);

    if (existingProfile) {
      await supabaseAdmin!
        .from("learner_profiles")
        .update({
          learning_style: {
            ...existingProfile.learning_style,
            ...Object.fromEntries(lsEntries),
          },
          strengths: [...new Set([...(existingProfile.strengths || []), memoryUpdate.strength_update])],
          weaknesses: [...new Set([...(existingProfile.weaknesses || []), memoryUpdate.weakness_update])],
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProfile.id);
    }

    return NextResponse.json({
      success: true,
      score,
      total,
      percentage,
      passed,
      progress: newProgress,
      memory_update: memoryUpdate,
    });
  } catch (err) {
    console.error("Quiz error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
