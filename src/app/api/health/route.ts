import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  try {
    const { error } = await supabaseAdmin!
      .from("users")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        {
          ready: false,
          message: "Database tables are missing. Run supabase/migrations/001_initial.sql in the Supabase dashboard SQL Editor, then seed with POST /api/seed.",
          error: error.message,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ready: true,
      message: "Database is ready.",
      defaultModel: process.env.FIREWORKS_MODEL || "accounts/fireworks/models/deepseek-v4-flash",
      gemma3Configured: !!(process.env.GEMMA_3_DEPLOYMENT || process.env.GEMMA_3_ENDPOINT),
      gemma4Configured: !!(process.env.GEMMA_4_DEPLOYMENT || process.env.GEMMA_4_ENDPOINT),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json(
      { ready: false, message: "Could not connect to Supabase.", error: message },
      { status: 503 }
    );
  }
}
