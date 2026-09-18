import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";


const QuestionSchema = z.object({
  subject: z.enum(["Physics", "Chemistry", "Maths"]),
  question_type: z.enum(["mcq", "numerical"]),
  question_text: z.string().min(1, "Question text required"),
  image_url: z.string().url().optional().nullable(),
  option_a: z.string().optional().nullable(),
  option_b: z.string().optional().nullable(),
  option_c: z.string().optional().nullable(),
  option_d: z.string().optional().nullable(),
  option_a_image: z.string().url().optional().nullable(),
  option_b_image: z.string().url().optional().nullable(),
  option_c_image: z.string().url().optional().nullable(),
  option_d_image: z.string().url().optional().nullable(),
  correct_option: z.enum(["A", "B", "C", "D"]).optional().nullable(),
  correct_numerical: z.number().optional().nullable(),
  tolerance: z.number().optional().nullable(),
  marks_correct: z.number().default(4),
  marks_wrong: z.number().default(-1),
});

// GET /api/admin/questions — list all questions
export async function GET(req: NextRequest) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const subject = searchParams.get("subject");
  const type = searchParams.get("type");

  let query = supabase.from("questions").select("*").order("created_at", { ascending: false });
  if (subject) query = query.eq("subject", subject);
  if (type) query = query.eq("question_type", type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/questions — create question
export async function POST(req: NextRequest) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = QuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase.from("questions").insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
