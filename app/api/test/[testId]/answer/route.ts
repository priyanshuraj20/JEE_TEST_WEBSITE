import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { z } from "zod";

const AnswerSchema = z.object({
  attempt_id: z.string().uuid(),
  question_id: z.string().uuid(),
  selected_option: z.enum(["A", "B", "C", "D"]).optional().nullable(),
  entered_number: z.number().optional().nullable(),
  marked_for_review: z.boolean().optional(),
});

// POST /api/test/[testId]/answer — autosave a single answer
export async function POST(req: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const body = await req.json();

  const parsed = AnswerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { attempt_id, question_id, selected_option, entered_number, marked_for_review } = parsed.data;

  // Fetch attempt to validate and check time
  const { data: attempt, error: attemptError } = await supabase
    .from("attempts")
    .select("id, test_id, start_time, status, answers")
    .eq("id", attempt_id)
    .eq("test_id", testId)
    .single();

  if (attemptError || !attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  if (attempt.status === "submitted") {
    return NextResponse.json({ error: "Test already submitted", auto_submitted: true }, { status: 409 });
  }

  // Server-side time check
  const { data: test } = await supabase
    .from("tests")
    .select("duration_minutes")
    .eq("id", testId)
    .single();

  if (test) {
    const elapsed = (Date.now() - new Date(attempt.start_time).getTime()) / 1000;
    if (elapsed >= test.duration_minutes * 60) {
      // Auto-submit: time expired
      return NextResponse.json({ error: "Time expired", auto_submitted: true }, { status: 410 });
    }
  }

  // Merge new answer into existing JSONB using Supabase's jsonb merge
  // Build the answer object for this question
  const answerValue: Record<string, unknown> = {};
  if (selected_option !== undefined) answerValue.selected_option = selected_option;
  if (entered_number !== undefined) answerValue.entered_number = entered_number;
  if (marked_for_review !== undefined) answerValue.marked_for_review = marked_for_review;

  // Get current answers and merge
  const currentAnswers: Record<string, unknown> = (attempt.answers as Record<string, unknown>) ?? {};
  const existingAnswer = (currentAnswers[question_id] as Record<string, unknown>) ?? {};
  currentAnswers[question_id] = { ...existingAnswer, ...answerValue };

  const { error: updateError } = await supabase
    .from("attempts")
    .update({ answers: currentAnswers })
    .eq("id", attempt_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved_at: new Date().toISOString() });
}
