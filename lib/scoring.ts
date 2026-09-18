/**
 * Score calculation logic.
 * Kept isolated so it can be used in both API routes and admin dashboard.
 */

export interface Answer {
  selected_option?: string; // "A" | "B" | "C" | "D"
  entered_number?: number | null;
  marked_for_review?: boolean;
}

export interface Question {
  id: string;
  question_type: "mcq" | "numerical";
  correct_option?: string | null;
  correct_numerical?: number | null;
  tolerance?: number | null;
  marks_correct: number;
  marks_wrong: number;
}

export interface ScoreResult {
  score: number;
  correct_count: number;
  wrong_count: number;
  unattempted_count: number;
  subject_scores: Record<string, { score: number; correct: number; wrong: number; unattempted: number }>;
}

export function calculateScore(
  questions: (Question & { subject: string })[],
  answers: Record<string, Answer>
): ScoreResult {
  let score = 0;
  let correct_count = 0;
  let wrong_count = 0;
  let unattempted_count = 0;

  const subject_scores: ScoreResult["subject_scores"] = {};

  for (const q of questions) {
    if (!subject_scores[q.subject]) {
      subject_scores[q.subject] = { score: 0, correct: 0, wrong: 0, unattempted: 0 };
    }
    const ans = answers[q.id];
    const subj = subject_scores[q.subject];

    if (q.question_type === "mcq") {
      if (!ans?.selected_option) {
        unattempted_count++;
        subj.unattempted++;
      } else if (ans.selected_option === q.correct_option) {
        score += q.marks_correct;
        subj.score += q.marks_correct;
        correct_count++;
        subj.correct++;
      } else {
        score += q.marks_wrong;
        subj.score += q.marks_wrong;
        wrong_count++;
        subj.wrong++;
      }
    } else {
      // numerical
      const entered = ans?.entered_number;
      if (entered === undefined || entered === null || ans?.entered_number === undefined) {
        unattempted_count++;
        subj.unattempted++;
      } else {
        const tol = q.tolerance ?? 0;
        const correct = q.correct_numerical ?? 0;
        if (Math.abs(entered - correct) <= tol) {
          score += q.marks_correct;
          subj.score += q.marks_correct;
          correct_count++;
          subj.correct++;
        } else {
          // numerical wrong — apply marks_wrong (usually 0 for JEE numerical)
          if (q.marks_wrong !== 0) {
            score += q.marks_wrong;
            subj.score += q.marks_wrong;
          }
          wrong_count++;
          subj.wrong++;
        }
      }
    }
  }

  return { score, correct_count, wrong_count, unattempted_count, subject_scores };
}
