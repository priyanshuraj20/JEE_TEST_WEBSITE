import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { isAdminAuthenticated } from "@/lib/auth";


// GET /api/admin/tests/[id] — test detail with all attempts
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const [testResult, attemptsResult, questionsResult] = await Promise.all([
    supabase.from("tests").select("*").eq("id", id).single(),
    supabase.from("attempts").select("*").eq("test_id", id).order("submit_time", { ascending: false }),
    supabase
      .from("test_questions")
      .select("question_order, questions(*)")
      .eq("test_id", id)
      .order("question_order"),
  ]);

  if (testResult.error) return NextResponse.json({ error: "Test not found" }, { status: 404 });

  return NextResponse.json({
    test: testResult.data,
    attempts: attemptsResult.data ?? [],
    questions: questionsResult.data?.map((tq: any) => ({ ...tq.questions, order: tq.question_order })) ?? [],
  });
}

// PATCH /api/admin/tests/[id] — publish results or update
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();

  const allowed = ["results_published", "title", "duration_minutes"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const { data, error } = await supabase.from("tests").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/admin/tests/[id]
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { error } = await supabase.from("tests").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
