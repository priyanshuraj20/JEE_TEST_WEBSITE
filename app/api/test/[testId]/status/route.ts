import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";

// GET /api/test/[testId]/status?attempt_id=xxx
// Used by student page to check current state (for page refresh/revisit)
export async function GET(req: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const { searchParams } = new URL(req.url);
  const attemptId = searchParams.get("attempt_id");

  if (!attemptId) {
    return NextResponse.json({ error: "attempt_id required" }, { status: 400 });
  }

  const [attemptResult, testResult] = await Promise.all([
    supabase.from("attempts").select("*").eq("id", attemptId).eq("test_id", testId).single(),
    supabase.from("tests").select("id, title, duration_minutes, results_published").eq("id", testId).single(),
  ]);

  if (attemptResult.error || !attemptResult.data) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (testResult.error || !testResult.data) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }

  const attempt = attemptResult.data;
  const test = testResult.data;

  const elapsed = (Date.now() - new Date(attempt.start_time).getTime()) / 1000;
  const time_remaining = Math.max(0, Math.floor(test.duration_minutes * 60 - elapsed));

  return NextResponse.json({
    attempt_id: attempt.id,
    status: attempt.status,
    answers: attempt.answers,
    start_time: attempt.start_time,
    submit_time: attempt.submit_time,
    time_remaining_seconds: time_remaining,
    results_published: test.results_published,
    test_title: test.title,
    duration_minutes: test.duration_minutes,
  });
}
