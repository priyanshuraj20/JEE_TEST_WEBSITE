import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);


const CreateTestSchema = z.object({
  title: z.string().min(1, "Title required"),
  duration_minutes: z.number().int().min(1).max(600),
  question_ids: z.array(z.string().uuid()).min(1, "Select at least one question"),
});

// GET /api/admin/tests — list all tests with attempt counts
export async function GET(req: NextRequest) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tests, error } = await supabase
    .from("tests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get attempt counts for each test
  const testIds = tests?.map((t) => t.id) ?? [];
  const { data: attempts } = await supabase
    .from("attempts")
    .select("test_id, status")
    .in("test_id", testIds);

  const counts: Record<string, { total: number; submitted: number; in_progress: number }> = {};
  for (const a of attempts ?? []) {
    if (!counts[a.test_id]) counts[a.test_id] = { total: 0, submitted: 0, in_progress: 0 };
    counts[a.test_id].total++;
    if (a.status === "submitted") counts[a.test_id].submitted++;
    else counts[a.test_id].in_progress++;
  }

  return NextResponse.json(
    tests?.map((t) => ({ ...t, attempt_counts: counts[t.id] ?? { total: 0, submitted: 0, in_progress: 0 } })) ?? []
  );
}

// POST /api/admin/tests — create test
export async function POST(req: NextRequest) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Generate unique test code
  let testCode = nanoid();
  let attempts = 0;
  while (attempts < 5) {
    const { data } = await supabase.from("tests").select("id").eq("test_code", testCode).single();
    if (!data) break;
    testCode = nanoid();
    attempts++;
  }

  // Insert test
  const { data: test, error: testError } = await supabase
    .from("tests")
    .insert({ title: parsed.data.title, test_code: testCode, duration_minutes: parsed.data.duration_minutes })
    .select()
    .single();

  if (testError) return NextResponse.json({ error: testError.message }, { status: 500 });

  // Insert test_questions with ordering
  const testQuestions = parsed.data.question_ids.map((qid, idx) => ({
    test_id: test.id,
    question_id: qid,
    question_order: idx + 1,
  }));

  const { error: tqError } = await supabase.from("test_questions").insert(testQuestions);
  if (tqError) {
    // Rollback test
    await supabase.from("tests").delete().eq("id", test.id);
    return NextResponse.json({ error: tqError.message }, { status: 500 });
  }

  return NextResponse.json(test, { status: 201 });
}
