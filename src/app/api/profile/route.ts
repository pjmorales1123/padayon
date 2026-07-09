import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const { data: profile, error } = await supabaseAdmin!
      .from("learner_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    const { data: user } = await supabaseAdmin!
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    return NextResponse.json({ profile, user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId, name, language_confidence, learning_style, strengths, weaknesses, study_habits } =
      await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Update user name
    if (typeof name === "string" && name.trim().length > 0) {
      const { error: userErr } = await supabaseAdmin!
        .from("users")
        .update({ name: name.trim() })
        .eq("id", userId);
      if (userErr) throw userErr;
    }

    // Upsert learner profile
    const profilePayload: Record<string, unknown> = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    if (language_confidence) profilePayload.language_confidence = language_confidence;
    if (learning_style) profilePayload.learning_style = learning_style;
    if (Array.isArray(strengths)) profilePayload.strengths = strengths;
    if (Array.isArray(weaknesses)) profilePayload.weaknesses = weaknesses;
    if (study_habits) profilePayload.study_habits = study_habits;

    const { data: existingProfile, error: findErr } = await supabaseAdmin!
      .from("learner_profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (findErr && findErr.code !== "PGRST116") throw findErr;

    let profile;
    if (existingProfile) {
      const { data, error } = await supabaseAdmin!
        .from("learner_profiles")
        .update(profilePayload)
        .eq("id", existingProfile.id)
        .select()
        .single();
      if (error) throw error;
      profile = data;
    } else {
      const { data, error } = await supabaseAdmin!
        .from("learner_profiles")
        .insert(profilePayload)
        .select()
        .single();
      if (error) throw error;
      profile = data;
    }

    return NextResponse.json({ success: true, profile });
  } catch (err) {
    console.error("Profile update error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
