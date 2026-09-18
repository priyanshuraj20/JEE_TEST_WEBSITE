import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { z } from "zod";


const StartSchema = z.object({
  student_name: z.string().min(1).max(100).trim(),
  test_code: z.string().min(1).max(20).trim().toUpperCase(),
});

// POST /api/test/[testId]/start
export async function POST(req: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const body = await req.json();

  const parsed = StartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Name and test code are required" }, { status: 400 });
  }

  const { student_name, test_code } = parsed.data;

  // Verify test exists and code matches
  const { data: test, error: testError } = await supabase
    .from("tests")
    .select("id, title, test_code, duration_minutes, results_published")
    .eq("id", testId)
    .single();

  if (testError || !test) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }

  if (test.test_code.toUpperCase() !== test_code) {
    return NextResponse.json({ error: "Invalid test code" }, { status: 403 });
  }

  // Check for existing attempt
  const { data: existing } = await supabase
    .from("attempts")
    .select("*")
    .eq("test_id", testId)
    .eq("student_name", student_name)
    .single();

  if (existing) {
    if (existing.status === "submitted") {
      // Already submitted — check if results published
      if (test.results_published) {
        return NextResponse.json({ status: "results_published", attempt: existing });
      }
      return NextResponse.json({ status: "already_submitted", attempt: existing });
    }

    // Resume in-progress attempt — check if time has expired on server
    const startTime = new Date(existing.start_time).getTime();
    const elapsed = (Date.now() - startTime) / 1000;
    const totalDuration = test.duration_minutes * 60;

    if (elapsed >= totalDuration) {
      // Auto-submit expired attempt (without score since we don't have answers here — will calculate)
      await supabase
        .from("attempts")
        .update({ status: "submitted", submit_time: new Date().toISOString() })
        .eq("id", existing.id);
      return NextResponse.json({ status: "time_expired", attempt: existing });
    }

    return NextResponse.json({
      status: "resumed",
      attempt: existing,
      time_remaining_seconds: Math.floor(totalDuration - elapsed),
    });
  }

  // Create new attempt
  const { data: attempt, error: attemptError } = await supabase
    .from("attempts")
    .insert({ test_id: testId, student_name })
    .select()
    .single();

  if (attemptError) {
    // Unique constraint violation = duplicate name
    if (attemptError.code === "23505") {
      return NextResponse.json(
        { error: "That name is already taken for this test. Please use a different name (e.g. add a number like 'Rahul2')." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: attemptError.message }, { status: 500 });
  }

  return NextResponse.json({
    status: "started",
    attempt,
    time_remaining_seconds: test.duration_minutes * 60,
  });
}
