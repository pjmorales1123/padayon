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
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({ subjects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
