import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function generateUserId() {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Student";
    const userId = generateUserId();

    const { error: userErr } = await supabaseAdmin!
      .from("users")
      .insert({ id: userId, name });

    if (userErr) {
      console.error("Create user error:", userErr);
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }

    const { error: profileErr } = await supabaseAdmin!
      .from("learner_profiles")
      .insert({
        user_id: userId,
        language_confidence: {},
        learning_style: {},
        strengths: [],
        weaknesses: [],
        study_habits: {},
      });

    if (profileErr) {
      console.error("Create profile error:", profileErr);
      // Continue; profile can be created lazily later.
    }

    return NextResponse.json({ userId, name, message: "Profile created." });
  } catch (err) {
    console.error("Users POST error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
