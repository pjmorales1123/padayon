import { NextRequest, NextResponse } from "next/server";
import { getRun, getAllRuns } from "@/lib/agent-events";

export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get("requestId");
  if (requestId) {
    const run = getRun(requestId);
    if (!run) {
      return NextResponse.json({ run: null }, { status: 404 });
    }
    return NextResponse.json({ run });
  }

  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);
  return NextResponse.json({ runs: getAllRuns(limit) });
}
