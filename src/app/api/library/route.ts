import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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

    return NextResponse.json({ subjects });
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
