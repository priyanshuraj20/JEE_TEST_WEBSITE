import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";


const UpdateSchema = z.object({
  subject: z.enum(["Physics", "Chemistry", "Maths"]).optional(),
  question_type: z.enum(["mcq", "numerical"]).optional(),
  question_text: z.string().min(1).optional(),
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
  marks_correct: z.number().optional(),
  marks_wrong: z.number().optional(),
});

// GET /api/admin/questions/[id]
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { data, error } = await supabase.from("questions").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PUT /api/admin/questions/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase.from("questions").update(parsed.data).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/admin/questions/[id]
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
