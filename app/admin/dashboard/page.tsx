"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";

interface Test {
  id: string;
  title: string;
  test_code: string;
  duration_minutes: number;
  results_published: boolean;
  created_at: string;
  attempt_counts: { total: number; submitted: number; in_progress: number };
}

export default function AdminDashboard() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);

  async function loadTests() {
    const res = await fetch("/api/admin/tests");
    if (res.ok) setTests(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadTests(); }, []);

  async function publishResults(testId: string) {
    if (!confirm("Publish results? Students will be able to see their scores.")) return;
    setPublishing(testId);
    const res = await fetch(`/api/admin/tests/${testId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results_published: true }),
    });
    if (res.ok) {
      setTests((prev) => prev.map((t) => t.id === testId ? { ...t, results_published: true } : t));
    }
    setPublishing(null);
  }

  async function deleteTest(testId: string, title: string) {
    if (!confirm(`Delete "${title}"? This will also delete all student attempts. Cannot be undone.`)) return;
    const res = await fetch(`/api/admin/tests/${testId}`, { method: "DELETE" });
    if (res.ok) setTests((prev) => prev.filter((t) => t.id !== testId));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your mock tests</p>
          </div>
          <Link href="/admin/tests/new" className="btn-primary">
            + Create Test
          </Link>
        </div>

        {loading ? (
          <div className="card text-center py-12 text-gray-500">Loading tests…</div>
        ) : tests.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-gray-500 mb-4">No tests yet. Create your first test!</p>
            <Link href="/admin/tests/new" className="btn-primary">Create Test</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {tests.map((test) => (
              <div key={test.id} className="card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="font-semibold text-gray-900">{test.title}</h2>
                      <span className="bg-blue-100 text-blue-700 text-xs font-mono font-bold px-2 py-0.5 rounded">
                        {test.test_code}
                      </span>
                      {test.results_published && (
                        <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded">
                          Results Published
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                      <span>⏱ {test.duration_minutes} min</span>
                      <span>👥 {test.attempt_counts.total} students</span>
                      <span className="text-green-600">✓ {test.attempt_counts.submitted} submitted</span>
                      {test.attempt_counts.in_progress > 0 && (
                        <span className="text-orange-500">⟳ {test.attempt_counts.in_progress} in progress</span>
                      )}
                    </div>
                    <div className="mt-2">
                      <span className="text-xs text-gray-400">
                        Link: <span className="font-mono">/test/{test.id}</span>
                      </span>
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/test/${test.id}`;
                          navigator.clipboard.writeText(url);
                          alert("Link copied to clipboard!");
                        }}
                        className="ml-2 text-xs text-blue-600 hover:underline"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Link
                      href={`/admin/tests/${test.id}`}
                      className="btn-secondary text-sm py-1.5"
                    >
                      View Results
                    </Link>
                    {!test.results_published && (
                      <button
                        onClick={() => publishResults(test.id)}
                        disabled={publishing === test.id}
                        className="btn-success text-sm py-1.5"
                      >
                        {publishing === test.id ? "Publishing…" : "Publish Results"}
                      </button>
                    )}
                    <button
                      onClick={() => deleteTest(test.id, test.title)}
                      className="btn-danger text-sm py-1.5"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
