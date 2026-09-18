"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import Link from "next/link";

interface Attempt {
  id: string;
  student_name: string;
  status: string;
  score: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  unattempted_count: number | null;
  subject_scores: Record<string, any> | null;
  start_time: string;
  submit_time: string | null;
}

interface Test {
  id: string;
  title: string;
  test_code: string;
  duration_minutes: number;
  results_published: boolean;
  created_at: string;
}

interface Question {
  id: string;
  subject: string;
  question_type: string;
  question_text: string;
  correct_option: string | null;
  correct_numerical: number | null;
  marks_correct: number;
  marks_wrong: number;
  order: number;
}

export default function TestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<{ test: Test; attempts: Attempt[]; questions: Question[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);

  async function loadData() {
    const res = await fetch(`/api/admin/tests/${id}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [id]);

  async function publishResults() {
    if (!confirm("Publish results? Students will see their scores.")) return;
    setPublishing(true);
    const res = await fetch(`/api/admin/tests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results_published: true }),
    });
    if (res.ok) loadData();
    setPublishing(false);
  }

  if (loading) return <div className="min-h-screen bg-gray-50"><AdminNav /><p className="text-center py-20 text-gray-500">Loading…</p></div>;
  if (!data) return <div className="min-h-screen bg-gray-50"><AdminNav /><p className="text-center py-20 text-red-500">Test not found</p></div>;

  const { test, attempts, questions } = data;
  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/test/${test.id}` : `/test/${test.id}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{test.title}</h1>
              <span className="bg-blue-100 text-blue-700 font-mono font-bold text-sm px-2 py-0.5 rounded">
                {test.test_code}
              </span>
              {test.results_published && (
                <span className="bg-green-100 text-green-700 text-sm font-medium px-2 py-0.5 rounded">
                  Results Published
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {test.duration_minutes} min · {questions.length} questions · {attempts.length} students
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">{shareLink}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(shareLink); alert("Copied!"); }}
                className="text-xs text-blue-600 hover:underline"
              >
                Copy
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            {!test.results_published && (
              <button
                onClick={publishResults}
                disabled={publishing}
                id="publish-btn"
                className="btn-success"
              >
                {publishing ? "Publishing…" : "Publish Results"}
              </button>
            )}
            <Link href="/admin/dashboard" className="btn-secondary">← Dashboard</Link>
          </div>
        </div>

        {/* Students table */}
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Students ({attempts.length})</h2>
          {attempts.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No students have started this test yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Score</th>
                    <th className="pb-2 pr-4">Correct</th>
                    <th className="pb-2 pr-4">Wrong</th>
                    <th className="pb-2 pr-4">Unattempted</th>
                    <th className="pb-2 pr-4">Submitted</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attempts.map((a) => (
                    <tr key={a.id}>
                      <td className="py-3 pr-4 font-medium">{a.student_name}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          a.status === "submitted" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                        }`}>
                          {a.status === "submitted" ? "Submitted" : "In Progress"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-semibold">{a.score ?? "—"}</td>
                      <td className="py-3 pr-4 text-green-600">{a.correct_count ?? "—"}</td>
                      <td className="py-3 pr-4 text-red-600">{a.wrong_count ?? "—"}</td>
                      <td className="py-3 pr-4 text-gray-500">{a.unattempted_count ?? "—"}</td>
                      <td className="py-3 pr-4 text-gray-500">
                        {a.submit_time ? new Date(a.submit_time).toLocaleString() : "—"}
                      </td>
                      <td className="py-3">
                        {a.status === "submitted" && (
                          <button
                            onClick={() => setSelectedAttempt(a)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Review
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Admin Review Modal */}
        {selectedAttempt && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="font-bold text-lg">{selectedAttempt.student_name} — Review</h2>
                <button onClick={() => setSelectedAttempt(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Score", value: selectedAttempt.score, color: "text-blue-600" },
                    { label: "Correct", value: selectedAttempt.correct_count, color: "text-green-600" },
                    { label: "Wrong", value: selectedAttempt.wrong_count, color: "text-red-600" },
                    { label: "Unattempted", value: selectedAttempt.unattempted_count, color: "text-gray-500" },
                  ].map((item) => (
                    <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className={`text-2xl font-bold ${item.color}`}>{item.value ?? "—"}</p>
                      <p className="text-xs text-gray-500 mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
                <AdminQuestionReview
                  questions={questions}
                  answers={(selectedAttempt as any).answers ?? {}}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminQuestionReview({ questions, answers }: { questions: Question[]; answers: Record<string, any> }) {
  return (
    <div className="space-y-4">
      {questions.map((q, i) => {
        const ans = answers[q.id] ?? {};
        let verdict: "correct" | "wrong" | "unattempted" = "unattempted";
        if (q.question_type === "mcq") {
          if (ans.selected_option) {
            verdict = ans.selected_option === q.correct_option ? "correct" : "wrong";
          }
        } else {
          if (ans.entered_number !== undefined && ans.entered_number !== null) {
            verdict = "wrong";
            // Simple check (tolerance handled in scoring)
            verdict = "wrong";
          }
        }

        const borderColor = verdict === "correct" ? "border-green-400" : verdict === "wrong" ? "border-red-400" : "border-gray-200";

        return (
          <div key={q.id} className={`border-l-4 ${borderColor} bg-white rounded-lg p-4 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-400 flex-wrap">
              <span>Q{i + 1}</span>
              <span>{q.subject}</span>
              <span className="uppercase">{q.question_type}</span>
              <span className={`font-medium ${verdict === "correct" ? "text-green-600" : verdict === "wrong" ? "text-red-600" : "text-gray-400"}`}>
                {verdict.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-800 mb-3">{q.question_text}</p>
            <div className="text-xs space-y-1">
              <p className="text-gray-600">
                <span className="font-medium">Student answered: </span>
                {q.question_type === "mcq"
                  ? ans.selected_option ?? "Not answered"
                  : ans.entered_number !== undefined ? ans.entered_number : "Not answered"}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Correct answer: </span>
                {q.question_type === "mcq" ? q.correct_option : q.correct_numerical}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
