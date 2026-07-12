import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function normalizeTopicKey(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeMaterialLists(existing: Array<Record<string, unknown>>, incoming: Array<Record<string, unknown>>) {
  const byType = new Map<string, Record<string, unknown>>();
  for (const material of [...existing, ...incoming]) {
    const type = String(material.type || "");
    const current = byType.get(type);
    const materialCreatedAt = String(material.created_at || "");
    const currentCreatedAt = String(current?.created_at || "");
    if (!current || materialCreatedAt >= currentCreatedAt) {
      byType.set(type, material);
    }
  }
  return Array.from(byType.values());
}

function dedupeTopicsForLibrary(subjects: Array<Record<string, unknown>>) {
  return subjects.map((subject) => {
    const topics = Array.isArray(subject.topics) ? (subject.topics as Array<Record<string, unknown>>) : [];
    const merged = new Map<string, Record<string, unknown>>();

    for (const topic of topics) {
      const key = normalizeTopicKey(String(topic.title || ""));
      if (!key) continue;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...topic, materials: Array.isArray(topic.materials) ? topic.materials : [] });
        continue;
      }

      const existingLast = String(existing.last_studied_at || "");
      const topicLast = String(topic.last_studied_at || "");
      const newer = topicLast >= existingLast ? topic : existing;
      merged.set(key, {
        ...existing,
        ...newer,
        materials: mergeMaterialLists(
          Array.isArray(existing.materials) ? (existing.materials as Array<Record<string, unknown>>) : [],
          Array.isArray(topic.materials) ? (topic.materials as Array<Record<string, unknown>>) : [],
        ),
      });
    }

    return {
      ...subject,
      topics: Array.from(merged.values()).sort((a, b) => {
        const aTime = new Date(String(a.last_studied_at || 0)).getTime();
        const bTime = new Date(String(b.last_studied_at || 0)).getTime();
        return bTime - aTime;
      }),
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const { data: subjects, error } = await supabaseAdmin!
      .from("subjects")
      .select(`
        *,
        topics (
          *,
          materials (*)
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("last_studied_at", { referencedTable: "topics", ascending: false });

    if (error) throw error;

    return NextResponse.json({ subjects: dedupeTopicsForLibrary((subjects || []) as Array<Record<string, unknown>>) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, name } = await req.json();
    if (!userId || !name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Missing userId or name" }, { status: 400 });
    }

    const { data: subject, error } = await supabaseAdmin!
      .from("subjects")
      .insert({ user_id: userId, name: name.trim() })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, subject });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { subjectId, name } = await req.json();
    if (!subjectId || !name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Missing subjectId or name" }, { status: 400 });
    }

    const { data: subject, error } = await supabaseAdmin!
      .from("subjects")
      .update({ name: name.trim() })
      .eq("id", subjectId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, subject });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get("subjectId");
    if (!subjectId) {
      return NextResponse.json({ error: "Missing subjectId" }, { status: 400 });
    }

    const { error } = await supabaseAdmin!.from("subjects").delete().eq("id", subjectId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
