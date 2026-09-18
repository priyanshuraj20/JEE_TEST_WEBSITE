import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";

// GET /api/test/[testId]/questions — returns questions WITHOUT correct answers
export async function GET(req: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const { searchParams } = new URL(req.url);
  const attemptId = searchParams.get("attemptId");

  if (!attemptId) {
    return NextResponse.json({ error: "attemptId required" }, { status: 400 });
  }

  // Verify attempt belongs to this test
  const { data: attempt, error: attemptError } = await supabase
    .from("attempts")
    .select("id, test_id, status")
    .eq("id", attemptId)
    .eq("test_id", testId)
    .single();

  if (attemptError || !attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  // Fetch questions for this test (without correct answers)
  const { data: testQuestions, error } = await supabase
    .from("test_questions")
    .select(`
      question_order,
      questions (
        id, subject, question_type, question_text, image_url,
        option_a, option_b, option_c, option_d,
        option_a_image, option_b_image, option_c_image, option_d_image,
        marks_correct, marks_wrong
      )
    `)
    .eq("test_id", testId)
    .order("question_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const questions = testQuestions?.map((tq: any) => ({
    ...tq.questions,
    order: tq.question_order,
  })) ?? [];

  return NextResponse.json({ questions });
}
