import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: topicId } = await params;

    const { data: topic, error: topicErr } = await supabaseAdmin!
      .from("topics")
      .select(`
        *,
        subjects (*),
        materials (*)
      `)
      .eq("id", topicId)
      .single();

    if (topicErr) throw topicErr;

    const { data: messages, error: msgErr } = await supabaseAdmin!
      .from("messages")
      .select("*")
      .eq("topic_id", topicId)
      .order("created_at", { ascending: true });

    if (msgErr) throw msgErr;

    return NextResponse.json({ topic, messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: topicId } = await params;
    const { title } = await req.json();

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    const { data: topic, error } = await supabaseAdmin!
      .from("topics")
      .update({ title: title.trim() })
      .eq("id", topicId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, topic });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: topicId } = await params;

    const { error } = await supabaseAdmin!.from("topics").delete().eq("id", topicId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
