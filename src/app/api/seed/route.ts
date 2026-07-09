import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Seed user
    const { data: user, error: userErr } = await supabaseAdmin!
      .from("users")
      .upsert({ id: userId, name: "Prince" }, { onConflict: "id" })
      .select()
      .single();
    if (userErr) throw userErr;

    // Seed learner profile
    const { error: profileErr } = await supabaseAdmin!
      .from("learner_profiles")
      .upsert(
        {
          user_id: userId,
          language_confidence: { Cebuano: "High", Filipino: "Medium", "Academic English": "Developing" },
          learning_style: { analogies: true, visuals: true, short_explanations: true },
          strengths: ["Real-life examples", "Story-based explanations", "Diagrams"],
          weaknesses: ["Scientific vocabulary", "Process order in Photosynthesis"],
          study_habits: { preferred_time: "evening", review_frequency: "daily" },
        },
        { onConflict: "user_id" }
      );
    if (profileErr) throw profileErr;

    // Seed curriculum items
    const curriculumItems = [
      { grade_level: "Grade 9", subject: "Science", subcategory: "Biology", topic: "Photosynthesis", competency: "Explain how plants make food through photosynthesis.", previous_topic: "Plant structures", next_topic: "Cellular respiration" },
      { grade_level: "Grade 9", subject: "Science", subcategory: "Biology", topic: "Cellular Respiration", competency: "Explain how cells release energy from food.", previous_topic: "Photosynthesis", next_topic: "Ecosystem" },
      { grade_level: "Grade 9", subject: "Science", subcategory: "Biology", topic: "Ecosystem", competency: "Explain interactions among living things and their environment.", previous_topic: "Cellular Respiration", next_topic: null },
      { grade_level: "Grade 9", subject: "Math", subcategory: "Algebra", topic: "Factoring", competency: "Factor polynomials using appropriate methods.", previous_topic: null, next_topic: "Quadratic Equations" },
      { grade_level: "Grade 9", subject: "Math", subcategory: "Algebra", topic: "Quadratic Equations", competency: "Solve quadratic equations using different methods.", previous_topic: "Factoring", next_topic: "Quadratic Formula" },
      { grade_level: "Grade 9", subject: "Math", subcategory: "Algebra", topic: "Quadratic Formula", competency: "Solve quadratic equations using the quadratic formula.", previous_topic: "Quadratic Equations", next_topic: null },
      { grade_level: "Grade 9", subject: "English", subcategory: "Literature", topic: "Point of View", competency: "Identify and analyze point of view in literary texts.", previous_topic: null, next_topic: "Characterization" },
      { grade_level: "Grade 9", subject: "English", subcategory: "Literature", topic: "Characterization", competency: "Analyze how characters are developed in a text.", previous_topic: "Point of View", next_topic: "Irony" },
      { grade_level: "Grade 9", subject: "English", subcategory: "Literature", topic: "Irony", competency: "Identify and explain irony in literary texts.", previous_topic: "Characterization", next_topic: null },
    ];

    for (const item of curriculumItems) {
      await supabaseAdmin!
        .from("curriculum_items")
        .upsert(item as unknown as Record<string, unknown>, { onConflict: "topic" });
    }

    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.error("Seed error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
