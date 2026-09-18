import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";

// GET /api/test/[testId]/results?attempt_id=xxx
// Returns full result data only if results_published = true
export async function GET(req: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const { searchParams } = new URL(req.url);
  const attemptId = searchParams.get("attempt_id");

  if (!attemptId) {
    return NextResponse.json({ error: "attempt_id required" }, { status: 400 });
  }

  const [testResult, attemptResult] = await Promise.all([
    supabase.from("tests").select("*").eq("id", testId).single(),
    supabase.from("attempts").select("*").eq("id", attemptId).eq("test_id", testId).single(),
  ]);

  if (testResult.error || !testResult.data) return NextResponse.json({ error: "Test not found" }, { status: 404 });
  if (attemptResult.error || !attemptResult.data) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

  const test = testResult.data;
  const attempt = attemptResult.data;

  if (!test.results_published) {
    return NextResponse.json({ error: "Results not published yet" }, { status: 403 });
  }

  if (attempt.status !== "submitted") {
    return NextResponse.json({ error: "Attempt not submitted" }, { status: 400 });
  }

  // Fetch questions WITH correct answers (for review)
  const { data: testQuestions, error: qError } = await supabase
    .from("test_questions")
    .select(`
      question_order,
      questions (
        id, subject, question_type, question_text, image_url,
        option_a, option_b, option_c, option_d,
        option_a_image, option_b_image, option_c_image, option_d_image,
        correct_option, correct_numerical, tolerance,
        marks_correct, marks_wrong
      )
    `)
    .eq("test_id", testId)
    .order("question_order");

  if (qError) return NextResponse.json({ error: qError.message }, { status: 500 });

  const questions = testQuestions?.map((tq: any) => ({
    ...tq.questions,
    order: tq.question_order,
  })) ?? [];

  return NextResponse.json({
    test: { id: test.id, title: test.title, duration_minutes: test.duration_minutes },
    attempt: {
      student_name: attempt.student_name,
      score: attempt.score,
      correct_count: attempt.correct_count,
      wrong_count: attempt.wrong_count,
      unattempted_count: attempt.unattempted_count,
      subject_scores: attempt.subject_scores,
      submit_time: attempt.submit_time,
      answers: attempt.answers,
    },
    questions,
  });
}
