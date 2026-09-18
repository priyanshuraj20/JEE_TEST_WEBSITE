import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";

// Normalize camelCase / CSV field names → snake_case (DB columns)
function normalize(raw: Record<string, unknown>): Record<string, unknown> {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null) {
        const val = raw[k];
        if (typeof val === "string" && val.trim() === "") continue;
        return val;
      }
    }
    return undefined;
  };

  const rawSubject = String(get("subject") ?? "").trim().toLowerCase();
  let subject = "Physics";
  if (rawSubject.includes("math")) subject = "Maths";
  else if (rawSubject.includes("chem")) subject = "Chemistry";
  else if (rawSubject.includes("phys")) subject = "Physics";

  const rawType = String(get("question_type", "questionType", "type") ?? "mcq").trim().toLowerCase();
  const isNumerical = rawType === "numerical";
  const question_type = isNumerical ? "numerical" : "mcq";

  let correct_option: string | null = null;
  if (!isNumerical) {
    const rawOpt = String(get("correct_option", "correctOption", "answer") ?? "").trim().toUpperCase();
    if (["A", "B", "C", "D"].includes(rawOpt)) {
      correct_option = rawOpt;
    }
  }

  const rawNum = get("correct_numerical", "correctNumerical", "answer");
  const correct_numerical = isNumerical && rawNum !== undefined && rawNum !== null
    ? Number(rawNum)
    : null;

  return {
    subject,
    question_type,
    question_text:      String(get("question_text", "questionText", "question") ?? "").trim(),
    image_url:          get("image_url", "imageUrl") ?? null,
    option_a:           get("option_a", "optionA", "a") ? String(get("option_a", "optionA", "a")) : null,
    option_b:           get("option_b", "optionB", "b") ? String(get("option_b", "optionB", "b")) : null,
    option_c:           get("option_c", "optionC", "c") ? String(get("option_c", "optionC", "c")) : null,
    option_d:           get("option_d", "optionD", "d") ? String(get("option_d", "optionD", "d")) : null,
    option_a_image:     get("option_a_image", "optionAImage") ?? null,
    option_b_image:     get("option_b_image", "optionBImage") ?? null,
    option_c_image:     get("option_c_image", "optionCImage") ?? null,
    option_d_image:     get("option_d_image", "optionDImage") ?? null,
    correct_option,
    correct_numerical:  isNaN(correct_numerical as number) ? null : correct_numerical,
    tolerance:          Number(get("tolerance") ?? 0) || 0,
    marks_correct:      Number(get("marks_correct", "marksCorrect") ?? 4) || 4,
    marks_wrong:        Number(get("marks_wrong", "marksWrong") ?? (isNumerical ? 0 : -1)),
  };
}

const BulkQuestionSchema = z.object({
  subject: z.enum(["Physics", "Chemistry", "Maths"]),
  question_type: z.enum(["mcq", "numerical"]),
  question_text: z.string().min(1, "Question text is required"),
  image_url: z.string().optional().nullable(),
  option_a: z.string().optional().nullable(),
  option_b: z.string().optional().nullable(),
  option_c: z.string().optional().nullable(),
  option_d: z.string().optional().nullable(),
  correct_option: z.enum(["A", "B", "C", "D"]).optional().nullable(),
  correct_numerical: z.number().optional().nullable(),
  tolerance: z.number().optional().nullable(),
  marks_correct: z.number().default(4),
  marks_wrong: z.number().default(-1),
});

// POST /api/admin/questions/bulk
// Body: { questions: [...] } — parsed from JSON or CSV (caller parses CSV to JSON first)
export async function POST(req: NextRequest) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const rawQuestions: unknown[] = body.questions ?? [];

  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return NextResponse.json({ error: "No questions provided" }, { status: 400 });
  }

  if (rawQuestions.length > 500) {
    return NextResponse.json({ error: "Max 500 questions per bulk import" }, { status: 400 });
  }

  const parsed = [];
  const errors: { index: number; error: unknown }[] = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const normalized = normalize(rawQuestions[i] as Record<string, unknown>);
    const result = BulkQuestionSchema.safeParse(normalized);
    if (result.success) {
      parsed.push(result.data);
    } else {
      errors.push({ index: i, error: result.error.flatten() });
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Validation errors", details: errors, validCount: parsed.length },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.from("questions").insert(parsed).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inserted: data?.length ?? 0, ids: data?.map((r) => r.id) });
}
