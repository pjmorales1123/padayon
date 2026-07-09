import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  classifierAgent,
  curriculumAgent,
  materialCreatorAgent,
  teachingAgent,
  memoryAgent,
} from "@/lib/agents";
import { ChatMessage } from "@/lib/types";

interface MaterialContent {
  text?: string;
  reviewer?: string;
  flashcards?: Array<{ front: string; back: string }>;
  quiz?: Array<{ question: string; choices: string[]; answer: string }>;
}

const RETRIEVAL_INTENTS = [
  "retrieve_material",
  "make_flashcards",
  "make_reviewer",
  "make_quiz",
  "continue_learning",
];

function mapIntentToType(intent: string): string | null {
  if (intent === "make_flashcards") return "flashcards";
  if (intent === "make_quiz") return "quiz";
  if (intent === "make_reviewer") return "reviewer";
  return null;
}

function formatRetrievedMaterial(type: string, content: MaterialContent): string {
  if (type === "flashcards" && content?.flashcards) {
    const cards = content.flashcards as Array<{ front: string; back: string }>;
    return "\n\n" + cards.map((c, i) => `${i + 1}. ${c.front}\n   → ${c.back}`).join("\n\n");
  }
  if (type === "quiz" && content?.quiz) {
    const quiz = content.quiz as Array<{ question: string; choices: string[]; answer: string }>;
    return (
      "\n\n" +
      quiz
        .map(
          (q, i) =>
            `${i + 1}. ${q.question}\n   ${q.choices
              .map((c, j) => `${String.fromCharCode(65 + j)}. ${c}`)
              .join("\n   ")}\n   Answer: ${q.answer}`
        )
        .join("\n\n")
    );
  }
  if (type === "reviewer") {
    return "\n\n" + (content?.reviewer || "");
  }
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const { userId, message, quizResult } = await req.json();

    if (!userId || !message) {
      return NextResponse.json({ error: "Missing userId or message" }, { status: 400 });
    }

    // 1. Load recent conversation history for this user (across all topics)
    const { data: historyRows, error: historyErr } = await supabaseAdmin!
      .from("messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (historyErr) console.error("History load error:", historyErr);

    const history: ChatMessage[] = (historyRows || [])
      .reverse()
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // 2. Classifier Agent with history context
    const classification = await classifierAgent(message, history);

    // 3. Curriculum Alignment Agent
    const curriculum = await curriculumAgent(classification);

    // 4. Find or create subject
    let { data: subject } = await supabaseAdmin!
      .from("subjects")
      .select("*")
      .eq("user_id", userId)
      .eq("name", classification.subject)
      .single();

    if (!subject) {
      const { data: newSubject, error: subjErr } = await supabaseAdmin!
        .from("subjects")
        .insert({ user_id: userId, name: classification.subject })
        .select()
        .single();
      if (subjErr) throw subjErr;
      subject = newSubject;
    }

    // 5. Find or create topic
    let { data: topic } = await supabaseAdmin!
      .from("topics")
      .select("*")
      .eq("subject_id", subject.id)
      .eq("title", classification.topic)
      .single();

    if (!topic) {
      const { data: newTopic, error: topicErr } = await supabaseAdmin!
        .from("topics")
        .insert({
          subject_id: subject.id,
          title: classification.topic,
          subcategory: classification.subcategory,
          curriculum_match: curriculum,
          last_studied_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (topicErr) throw topicErr;
      topic = newTopic;
    } else {
      await supabaseAdmin!
        .from("topics")
        .update({ last_studied_at: new Date().toISOString() })
        .eq("id", topic.id);
    }

    // 6. Save original notes
    await supabaseAdmin!.from("messages").insert({
      user_id: userId,
      topic_id: topic.id,
      role: "user",
      content: message,
    });

    // 7. Retrieve existing materials if retrieval intent
    let isRetrieval = RETRIEVAL_INTENTS.includes(classification.intent);
    let materials_created: string[] = [];
    let reply = "";

    if (isRetrieval) {
      const { data: materials } = await supabaseAdmin!
        .from("materials")
        .select("*")
        .eq("topic_id", topic.id);

      const requestedType = mapIntentToType(classification.intent);

      if (requestedType && materials) {
        const found = materials.find((m) => m.type === requestedType);
        if (found) {
          reply = `Here are your saved ${classification.topic} ${requestedType} from ${classification.subject} → ${classification.subcategory}.`;
          reply += formatRetrievedMaterial(requestedType, found.content);
        } else {
          reply = `I don't have ${requestedType} for ${classification.topic} yet. Let me create them!`;
          isRetrieval = false; // fall through to creation
        }
      }
    }

    // 8. Generate materials if needed
    let studyPack = null;
    let savedMaterials: Array<{ type: string; id: string }> = [];

    if (!isRetrieval || reply.includes("Let me create them")) {
      const { data: profileRow } = await supabaseAdmin!
        .from("learner_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      const profile = profileRow || {};
      studyPack = await materialCreatorAgent(message, classification.topic, curriculum, profile);

      // Prepare material inserts
      const materialInserts = [
        { topic_id: topic.id, type: "original_notes", title: "Original Notes", content: { text: message } },
        { topic_id: topic.id, type: "clean_notes", title: "Clean Notes", content: { text: studyPack.clean_notes } },
        { topic_id: topic.id, type: "reviewer", title: "Reviewer", content: { text: studyPack.reviewer } },
        { topic_id: topic.id, type: "flashcards", title: "Flashcards", content: { flashcards: studyPack.flashcards } },
        { topic_id: topic.id, type: "quiz", title: "Quiz", content: { quiz: studyPack.quiz } },
        { topic_id: topic.id, type: "summary", title: "Summary", content: { text: studyPack.summary } },
      ];

      // Batch load existing materials for this topic to avoid N+1 selects
      const { data: existingMaterials } = await supabaseAdmin!
        .from("materials")
        .select("id, type")
        .eq("topic_id", topic.id);

      const existingByType = new Map((existingMaterials || []).map((m) => [m.type, m.id]));

      for (const m of materialInserts) {
        const existingId = existingByType.get(m.type);
        if (existingId) {
          const { error } = await supabaseAdmin!
            .from("materials")
            .update({ content: m.content })
            .eq("id", existingId);
          if (error) console.error("Material update error:", error);
        } else {
          const { data: inserted, error } = await supabaseAdmin!
            .from("materials")
            .insert(m as unknown as Record<string, unknown>)
            .select("id, type")
            .single();
          if (error) {
            console.error("Material insert error:", error);
          } else if (inserted) {
            existingByType.set(inserted.type, inserted.id);
          }
        }
      }

      savedMaterials = ["clean_notes", "reviewer", "flashcards", "quiz"].map((type) => ({
        type,
        id: existingByType.get(type) || "",
      }));
      materials_created = savedMaterials.map((m) => m.type);

      // Generate teaching response with full history context
      reply = await teachingAgent(message, classification.topic, curriculum, profile, history);
      if (!reply || reply.length < 10) {
        reply = `I organized this under ${classification.subject} → ${classification.subcategory} → ${classification.topic}.\n\nThis matches your ${curriculum.grade_level} ${classification.subject} learning path.\n\nI created:\n✓ Clean Notes\n✓ Reviewer\n✓ Flashcards\n✓ Quiz`;
      }
    }

    // 9. Save AI reply
    await supabaseAdmin!.from("messages").insert({
      user_id: userId,
      topic_id: topic.id,
      role: "assistant",
      content: reply,
    });

    // 10. Memory Agent with actual quiz result when available
    const memoryQuizResult = quizResult
      ? { ...quizResult, topic: classification.topic }
      : null;

    const { data: existingProfile } = await supabaseAdmin!
      .from("learner_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    const memoryUpdate = await memoryAgent(message, memoryQuizResult, existingProfile || {});

    // Update learner profile
    const lsUpdate = memoryUpdate.learning_style_update || "";
    const lsEntries = lsUpdate
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => [s, true]);

    const profileUpdate = {
      language_confidence: {
        ...(existingProfile?.language_confidence || {}),
        [classification.language_detected]: "High",
      },
      learning_style: {
        ...(existingProfile?.learning_style || {}),
        ...Object.fromEntries(lsEntries),
      },
      strengths: [
        ...new Set([
          ...(existingProfile?.strengths || []),
          memoryUpdate.strength_update,
        ]),
      ],
      weaknesses: [
        ...new Set([
          ...(existingProfile?.weaknesses || []),
          memoryUpdate.weakness_update,
        ]),
      ],
      updated_at: new Date().toISOString(),
    };

    if (existingProfile) {
      await supabaseAdmin!
        .from("learner_profiles")
        .update(profileUpdate)
        .eq("id", existingProfile.id);
    } else {
      await supabaseAdmin!.from("learner_profiles").insert({
        user_id: userId,
        language_confidence: profileUpdate.language_confidence,
        learning_style: profileUpdate.learning_style,
        strengths: profileUpdate.strengths,
        weaknesses: profileUpdate.weaknesses,
      });
    }

    return NextResponse.json({
      reply,
      classification,
      curriculum,
      topic,
      materials_created,
      saved_materials: savedMaterials,
      memory_update: memoryUpdate,
    });
  } catch (err) {
    console.error("Agent error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
