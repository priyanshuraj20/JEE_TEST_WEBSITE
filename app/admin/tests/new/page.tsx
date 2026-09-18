"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNav from "@/components/AdminNav";

interface Question {
  id: string;
  subject: string;
  question_type: string;
  question_text: string;
  marks_correct: number;
  marks_wrong: number;
}

const SUBJECTS = ["Physics", "Chemistry", "Maths"] as const;

export default function CreateTestPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(180);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState({ subject: "", type: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Quick-pick counts per subject/type
  const [quickPick, setQuickPick] = useState({
    Physics_mcq: "20", Physics_numerical: "5",
    Chemistry_mcq: "20", Chemistry_numerical: "5",
    Maths_mcq: "20", Maths_numerical: "5",
  });

  const [dbError, setDbError] = useState("");

  useEffect(() => {
    fetch("/api/admin/questions")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAllQuestions(data);
        } else {
          setDbError(data?.error ?? "Could not load questions. Have you run the Supabase schema SQL and set SUPABASE_SERVICE_ROLE_KEY?");
        }
        setLoading(false);
      })
      .catch(() => {
        setDbError("Network error loading questions.");
        setLoading(false);
      });
  }, []);

  function toggleQuestion(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function quickPickAll() {
    const picked = new Set<string>();
    for (const subject of SUBJECTS) {
      for (const type of ["mcq", "numerical"] as const) {
        const key = `${subject}_${type}` as keyof typeof quickPick;
        const count = parseInt(quickPick[key]) || 0;
        const pool = allQuestions.filter((q) => q.subject === subject && q.question_type === type);
        // shuffle
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        shuffled.slice(0, count).forEach((q) => picked.add(q.id));
      }
    }
    setSelectedIds(picked);
  }

  const filtered = allQuestions.filter((q) => {
    if (filter.subject && q.subject !== filter.subject) return false;
    if (filter.type && q.question_type !== filter.type) return false;
    return true;
  });

  const subjectCounts = SUBJECTS.map((s) => ({
    subject: s,
    mcq: allQuestions.filter((q) => q.subject === s && q.question_type === "mcq").length,
    numerical: allQuestions.filter((q) => q.subject === s && q.question_type === "numerical").length,
    selectedMcq: allQuestions.filter((q) => q.subject === s && q.question_type === "mcq" && selectedIds.has(q.id)).length,
    selectedNumerical: allQuestions.filter((q) => q.subject === s && q.question_type === "numerical" && selectedIds.has(q.id)).length,
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.size === 0) { setError("Select at least one question"); return; }
    if (!title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError("");

    // Preserve the order: Physics MCQ, Physics Numerical, Chemistry MCQ, ... as selected
    // Sort by: subject order, type (mcq first), then original order
    const orderedIds = [...selectedIds].sort((a, b) => {
      const qa = allQuestions.find((q) => q.id === a)!;
      const qb = allQuestions.find((q) => q.id === b)!;
      const subjOrder = SUBJECTS.indexOf(qa.subject as any) - SUBJECTS.indexOf(qb.subject as any);
      if (subjOrder !== 0) return subjOrder;
      const typeOrder = (qa.question_type === "mcq" ? 0 : 1) - (qb.question_type === "mcq" ? 0 : 1);
      return typeOrder;
    });

    const res = await fetch("/api/admin/tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, duration_minutes: duration, question_ids: orderedIds }),
    });

    if (res.ok) {
      const test = await res.json();
      router.push(`/admin/tests/${test.id}`);
    } else {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to create test");
    }
    setSaving(false);
  }

  const subjectColors: Record<string, string> = {
    Physics: "border-l-blue-400",
    Chemistry: "border-l-green-400",
    Maths: "border-l-purple-400",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Test</h1>

        {dbError && (
          <div className="mb-6 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl px-4 py-3 text-sm">
            <p className="font-semibold mb-1">⚠️ Database not connected</p>
            <p>{dbError}</p>
            <p className="mt-1 text-xs">Run <code className="bg-amber-100 px-1 rounded">supabase/schema.sql</code> in your Supabase SQL editor, then add <code className="bg-amber-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> to .env.local and restart the dev server.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic settings */}
          <div className="card grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Test Title *</label>
              <input
                id="test-title"
                type="text"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. JEE Main Mock Test 1"
                required
              />
            </div>
            <div>
              <label className="label">Duration (minutes) *</label>
              <input
                id="test-duration"
                type="number"
                className="input"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 180)}
                min={1}
                max={600}
              />
            </div>
          </div>

          {/* Quick-pick */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-800">Quick Pick by Subject/Type</h2>
                <p className="text-xs text-gray-500 mt-0.5">Set counts then click "Auto-Select" to randomly pick</p>
              </div>
              <button
                type="button"
                onClick={quickPickAll}
                id="auto-select-btn"
                className="btn-secondary text-sm"
              >
                Auto-Select
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs">
                    <th className="pb-2">Subject</th>
                    <th className="pb-2">MCQ Count</th>
                    <th className="pb-2">Available MCQ</th>
                    <th className="pb-2">Numerical Count</th>
                    <th className="pb-2">Available Numerical</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {subjectCounts.map((s) => (
                    <tr key={s.subject}>
                      <td className="py-2 font-medium">{s.subject}</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min={0}
                          className="input w-20 text-center"
                          value={(quickPick as any)[`${s.subject}_mcq`]}
                          onChange={(e) => setQuickPick((p) => ({ ...p, [`${s.subject}_mcq`]: e.target.value }))}
                        />
                      </td>
                      <td className="py-2 text-gray-500">{s.mcq} ({s.selectedMcq} selected)</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min={0}
                          className="input w-20 text-center"
                          value={(quickPick as any)[`${s.subject}_numerical`]}
                          onChange={(e) => setQuickPick((p) => ({ ...p, [`${s.subject}_numerical`]: e.target.value }))}
                        />
                      </td>
                      <td className="py-2 text-gray-500">{s.numerical} ({s.selectedNumerical} selected)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Manual question selection */}
          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-gray-800">
                  Or Manually Select Questions
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedIds.size} selected
                </p>
              </div>
              <div className="flex gap-2">
                <select className="input w-auto text-sm" value={filter.subject} onChange={(e) => setFilter((f) => ({ ...f, subject: e.target.value }))}>
                  <option value="">All Subjects</option>
                  <option>Physics</option>
                  <option>Chemistry</option>
                  <option>Maths</option>
                </select>
                <select className="input w-auto text-sm" value={filter.type} onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}>
                  <option value="">All Types</option>
                  <option value="mcq">MCQ</option>
                  <option value="numerical">Numerical</option>
                </select>
                {selectedIds.size > 0 && (
                  <button type="button" onClick={() => setSelectedIds(new Set())} className="btn-secondary text-xs">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <p className="text-gray-500 text-sm text-center py-8">Loading questions…</p>
            ) : filtered.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No questions match filter</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filtered.map((q) => (
                  <label
                    key={q.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border-l-4 cursor-pointer transition-colors ${
                      selectedIds.has(q.id) ? "bg-blue-50 border-blue-400" : `bg-gray-50 ${subjectColors[q.subject]}`
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-blue-600 shrink-0"
                      checked={selectedIds.has(q.id)}
                      onChange={() => toggleQuestion(q.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-2 flex-wrap mb-1">
                        <span className="text-xs text-gray-500">{q.subject}</span>
                        <span className="text-xs text-gray-400 uppercase">{q.question_type}</span>
                        <span className="text-xs text-gray-400">+{q.marks_correct}/{q.marks_wrong}</span>
                      </div>
                      <p className="text-sm text-gray-800 line-clamp-1">{q.question_text}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => router.push("/admin/dashboard")} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              id="create-test-btn"
              disabled={saving || selectedIds.size === 0}
              className="btn-primary"
            >
              {saving ? "Creating…" : `Create Test (${selectedIds.size} questions)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
