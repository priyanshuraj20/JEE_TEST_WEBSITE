"use client";
import { useEffect, useState, useRef } from "react";
import AdminNav from "@/components/AdminNav";
import QuestionForm from "@/components/QuestionForm";
import BulkImport from "@/components/BulkImport";

interface Question {
  id: string;
  subject: string;
  question_type: string;
  question_text: string;
  marks_correct: number;
  marks_wrong: number;
  created_at: string;
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ subject: "", type: "" });
  const [showForm, setShowForm] = useState(false);
  const [editQuestion, setEditQuestion] = useState<any>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [dbError, setDbError] = useState("");

  async function loadQuestions() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.subject) params.set("subject", filter.subject);
    if (filter.type) params.set("type", filter.type);
    const res = await fetch(`/api/admin/questions?${params}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      setQuestions(data);
      setDbError("");
    } else {
      setDbError(data?.error ?? "Database error — please run the Supabase schema SQL and add SUPABASE_SERVICE_ROLE_KEY to .env.local");
    }
    setLoading(false);
  }

  useEffect(() => { loadQuestions(); }, [filter]);

  async function deleteQuestion(id: string) {
    if (!confirm("Delete this question?")) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
    if (res.ok) setQuestions((prev) => prev.filter((q) => q.id !== id));
    else alert("Failed to delete question");
    setDeleting(null);
  }

  async function editQ(id: string) {
    const res = await fetch(`/api/admin/questions/${id}`);
    if (res.ok) {
      setEditQuestion(await res.json());
      setShowForm(true);
    }
  }

  function onSaved() {
    setShowForm(false);
    setEditQuestion(null);
    loadQuestions();
  }

  const subjectColors: Record<string, string> = {
    Physics: "bg-blue-100 text-blue-700",
    Chemistry: "bg-green-100 text-green-700",
    Maths: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {dbError && (
          <div className="mb-6 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl px-4 py-3 text-sm">
            <p className="font-semibold mb-1">⚠️ Database not connected</p>
            <p>{dbError}</p>
            <p className="mt-1 text-xs">Run <code className="bg-amber-100 px-1 rounded">supabase/schema.sql</code> in your Supabase SQL editor, then add <code className="bg-amber-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> to .env.local and restart.</p>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
            <p className="text-sm text-gray-500 mt-1">{questions.length} questions total</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowBulk(true)} className="btn-secondary text-sm">
              Bulk Import
            </button>
            <button
              id="add-question-btn"
              onClick={() => { setEditQuestion(null); setShowForm(true); }}
              className="btn-primary text-sm"
            >
              + Add Question
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            className="input w-auto text-sm"
            value={filter.subject}
            onChange={(e) => setFilter((f) => ({ ...f, subject: e.target.value }))}
          >
            <option value="">All Subjects</option>
            <option>Physics</option>
            <option>Chemistry</option>
            <option>Maths</option>
          </select>
          <select
            className="input w-auto text-sm"
            value={filter.type}
            onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="">All Types</option>
            <option value="mcq">MCQ</option>
            <option value="numerical">Numerical</option>
          </select>
        </div>

        {/* Question list */}
        {loading ? (
          <div className="card text-center py-12 text-gray-500">Loading…</div>
        ) : questions.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-gray-500 mb-4">No questions found. Add some!</p>
            <button onClick={() => setShowForm(true)} className="btn-primary">Add Question</button>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={q.id} className="card py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-xs font-medium text-gray-400">#{i + 1}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${subjectColors[q.subject] ?? "bg-gray-100 text-gray-700"}`}>
                        {q.subject}
                      </span>
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded uppercase">
                        {q.question_type}
                      </span>
                      <span className="text-xs text-gray-400">+{q.marks_correct} / {q.marks_wrong}</span>
                    </div>
                    <p className="text-sm text-gray-800 line-clamp-2">{q.question_text}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => editQ(q.id)}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      disabled={deleting === q.id}
                      className="text-xs text-red-600 hover:underline font-medium disabled:opacity-50"
                    >
                      {deleting === q.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Question Form Modal */}
      {showForm && (
        <QuestionForm
          initial={editQuestion}
          onSave={onSaved}
          onClose={() => { setShowForm(false); setEditQuestion(null); }}
        />
      )}

      {/* Bulk Import Modal */}
      {showBulk && (
        <BulkImport
          onDone={() => { setShowBulk(false); loadQuestions(); }}
          onClose={() => setShowBulk(false)}
        />
      )}
    </div>
  );
}
