import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { calculateScore } from "@/lib/scoring";

// POST /api/test/[testId]/submit
export async function POST(req: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const { attempt_id } = await req.json();

  if (!attempt_id) {
    return NextResponse.json({ error: "attempt_id required" }, { status: 400 });
  }

  // Fetch attempt
  const { data: attempt, error: attemptError } = await supabase
    .from("attempts")
    .select("*")
    .eq("id", attempt_id)
    .eq("test_id", testId)
    .single();

  if (attemptError || !attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  // Idempotent: already submitted
  if (attempt.status === "submitted") {
    return NextResponse.json({ ok: true, already_submitted: true });
  }

  // Fetch all questions WITH correct answers for scoring
  const { data: testQuestions, error: qError } = await supabase
    .from("test_questions")
    .select(`
      question_order,
      questions (
        id, subject, question_type,
        correct_option, correct_numerical, tolerance,
        marks_correct, marks_wrong
      )
    `)
    .eq("test_id", testId)
    .order("question_order");

  if (qError) return NextResponse.json({ error: qError.message }, { status: 500 });

  const questions = testQuestions?.map((tq: any) => tq.questions).filter(Boolean) ?? [];
  const answers = (attempt.answers as Record<string, any>) ?? {};

  // Calculate score
  const result = calculateScore(questions as any, answers);

  // Update attempt as submitted
  const { error: updateError } = await supabase
    .from("attempts")
    .update({
      status: "submitted",
      submit_time: new Date().toISOString(),
      score: result.score,
      correct_count: result.correct_count,
      wrong_count: result.wrong_count,
      unattempted_count: result.unattempted_count,
      subject_scores: result.subject_scores,
    })
    .eq("id", attempt_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, submitted: true });
}
