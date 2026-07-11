import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const PERSONAS = [
  {
    id: "demo-new-student",
    name: "Maria",
    profile: {
      language_confidence: { English: "Developing", Filipino: "Medium", Cebuano: "Developing" },
      learning_style: { analogies: true, short_explanations: true },
      strengths: ["Curious"],
      weaknesses: ["Academic English vocabulary"],
      study_habits: { preferred_time: "afternoon", review_frequency: "when_needed" },
    },
  },
  {
    id: "demo-bisaya-learner",
    name: "Juan",
    profile: {
      language_confidence: { English: "Developing", Filipino: "Medium", Cebuano: "High", "Academic English": "Developing" },
      learning_style: { analogies: true, visuals: true, stories: true, short_explanations: true },
      strengths: ["Real-life examples", "Story-based explanations"],
      weaknesses: ["Scientific vocabulary", "Process order in Photosynthesis"],
      study_habits: { preferred_time: "evening", review_frequency: "daily" },
    },
    seedTopic: {
      subject: "Science",
      subcategory: "Biology",
      title: "Photosynthesis",
      competency: "Explain how plants make food through photosynthesis.",
      materials: {
        clean_notes: "Photosynthesis is how plants use sunlight, water, and carbon dioxide to make food (glucose) and oxygen.",
        summary: "Plants turn sunlight + water + CO₂ into glucose and oxygen.",
        flashcards: [
          { front: "What is photosynthesis?", back: "The process where plants make food using sunlight, water, and CO₂." },
          { front: "What does chlorophyll do?", back: "It captures sunlight energy." },
        ],
        quiz: [
          {
            question: "What gas do plants take in during photosynthesis?",
            choices: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"],
            answer: "Carbon dioxide",
            explanation: "Plants use carbon dioxide from the air.",
          },
        ],
      },
      messages: [
        { role: "user", content: "Unsa ang photosynthesis? Dili ko kasabot sa English." },
        { role: "assistant", content: "Ang photosynthesis mao ang proseso nga gigamit sa tanom aron makahimo og pagkaon gamit ang sunlight. In English: Photosynthesis is how plants make food using sunlight, water, and carbon dioxide." },
      ],
    },
  },
  {
    id: "demo-english-advanced",
    name: "Alex",
    profile: {
      language_confidence: { English: "High", Filipino: "High", Cebuano: "Medium", "Academic English": "High" },
      learning_style: { deep_dive: true, connections: true, analogies: true },
      strengths: ["Critical thinking", "Literary analysis", "Making connections"],
      weaknesses: ["Occasionally skips steps in math proofs"],
      study_habits: { preferred_time: "morning", review_frequency: "daily" },
    },
    seedTopic: {
      subject: "English",
      subcategory: "Literature",
      title: "Irony",
      competency: "Identify and explain irony in literary texts.",
      materials: {
        clean_notes: "Irony is a contrast between expectation and reality. Three types: verbal, situational, dramatic.",
        summary: "Irony happens when reality differs from what is expected.",
        flashcards: [
          { front: "What is verbal irony?", back: "Saying the opposite of what you mean." },
          { front: "What is situational irony?", back: "When the opposite of what is expected happens." },
        ],
        quiz: [
          {
            question: "A fire station burns down. What type of irony is this?",
            choices: ["Verbal irony", "Situational irony", "Dramatic irony", "No irony"],
            answer: "Situational irony",
            explanation: "The outcome is the opposite of what is expected.",
          },
        ],
      },
      messages: [
        { role: "user", content: "Can you explain situational irony with a harder example?" },
        { role: "assistant", content: "Situational irony is when reality contradicts expectation. For example, a traffic cop getting a parking ticket — the person enforcing rules breaks them." },
      ],
    },
  },
  {
    id: "demo-struggling-student",
    name: "Bea",
    profile: {
      language_confidence: { English: "Developing", Filipino: "High", Cebuano: "Medium" },
      learning_style: { short_explanations: true, encouragement: true, stories: true },
      strengths: ["Asks questions", "Tries again after mistakes"],
      weaknesses: ["Gets discouraged easily", "Math anxiety", "Needs vocabulary support"],
      study_habits: { preferred_time: "evening", review_frequency: "sporadic" },
    },
    seedTopic: {
      subject: "Math",
      subcategory: "Algebra",
      title: "Quadratic Equations",
      competency: "Solve quadratic equations using different methods.",
      materials: {
        clean_notes: "A quadratic equation has the form ax² + bx + c = 0. We can solve it by factoring, completing the square, or the quadratic formula.",
        summary: "Quadratic equations are ax² + bx + c = 0 and can be solved in multiple ways.",
        flashcards: [
          { front: "Standard form of a quadratic equation", back: "ax² + bx + c = 0" },
          { front: "What is the quadratic formula?", back: "x = (-b ± √(b² - 4ac)) / 2a" },
        ],
        quiz: [
          {
            question: "In x² + 5x + 6 = 0, what is c?",
            choices: ["1", "5", "6", "x"],
            answer: "6",
            explanation: "c is the constant term.",
          },
        ],
      },
      messages: [
        { role: "user", content: "I don't get quadratic equations. It looks hard." },
        { role: "assistant", content: "That's okay, Bea. Let's take it one tiny step at a time. A quadratic equation just means the highest power of x is 2, like x². We'll use simple examples first." },
      ],
    },
  },
];

export async function POST(req: NextRequest) {
  try {
    const { reset = false } = await req.json().catch(() => ({}));
    const created: Array<{ id: string; name: string; subject?: string; topic?: string }> = [];

    for (const p of PERSONAS) {
      // Create or update user
      await supabaseAdmin!
        .from("users")
        .upsert({ id: p.id, name: p.name }, { onConflict: "id" });

      // Create or update profile
      await supabaseAdmin!
        .from("learner_profiles")
        .upsert(
          {
            user_id: p.id,
            language_confidence: p.profile.language_confidence,
            learning_style: p.profile.learning_style,
            strengths: p.profile.strengths,
            weaknesses: p.profile.weaknesses,
            study_habits: p.profile.study_habits,
          },
          { onConflict: "user_id" }
        );

      if (reset) {
        // Clear old seeded topics/messages for this persona
        const { data: subjects } = await supabaseAdmin!.from("subjects").select("id").eq("user_id", p.id);
        for (const s of subjects || []) {
          await supabaseAdmin!.from("subjects").delete().eq("id", s.id);
        }
        await supabaseAdmin!.from("messages").delete().eq("user_id", p.id);
      }

      if (p.seedTopic) {
        // Create subject
        const { data: subjectRow } = await supabaseAdmin!
          .from("subjects")
          .upsert({ user_id: p.id, name: p.seedTopic.subject }, { onConflict: "user_id,name" })
          .select()
          .single();

        if (subjectRow) {
          // Create topic
          const { data: topicRow } = await supabaseAdmin!
            .from("topics")
            .upsert(
              {
                subject_id: subjectRow.id,
                title: p.seedTopic.title,
                subcategory: p.seedTopic.subcategory,
                curriculum_match: {
                  grade_level: "Grade 9",
                  subject: p.seedTopic.subject,
                  subcategory: p.seedTopic.subcategory,
                  topic: p.seedTopic.title,
                  competency: p.seedTopic.competency,
                },
                progress: { confidence: 35, attempts: 1, correct: 0, incorrect: 1, interactions: 2, status: "started" },
                last_studied_at: new Date().toISOString(),
              },
              { onConflict: "subject_id,title" }
            )
            .select()
            .single();

          if (topicRow) {
            // Seed materials
            const materialInserts = [
              { topic_id: topicRow.id, type: "clean_notes", title: "Clean Notes", content: { text: p.seedTopic.materials.clean_notes } },
              { topic_id: topicRow.id, type: "summary", title: "Summary", content: { text: p.seedTopic.materials.summary } },
              { topic_id: topicRow.id, type: "flashcards", title: "Flashcards", content: { flashcards: p.seedTopic.materials.flashcards } },
              { topic_id: topicRow.id, type: "quiz", title: "Quiz", content: { quiz: p.seedTopic.materials.quiz } },
            ];

            for (const m of materialInserts) {
              await supabaseAdmin!
                .from("materials")
                .upsert(m as unknown as Record<string, unknown>, { onConflict: "topic_id,type" });
            }

            // Seed messages
            for (const msg of p.seedTopic.messages) {
              await supabaseAdmin!.from("messages").insert({
                user_id: p.id,
                topic_id: topicRow.id,
                role: msg.role,
                content: msg.content,
              });
            }
          }
        }
      }

      created.push({ id: p.id, name: p.name, subject: p.seedTopic?.subject, topic: p.seedTopic?.title });
    }

    return NextResponse.json({ success: true, personas: created });
  } catch (err) {
    console.error("Seed personas error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
