"use client";
import { useState, useRef } from "react";

interface Props {
  onDone: () => void;
  onClose: () => void;
}

// CSV parsing utility (handles simple CSV)
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase().replace(/ /g, "_"));
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let cur = "";
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { values.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    values.push(cur.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

function toNumber(val: string): number | null {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function csvRowToQuestion(row: Record<string, string>): any {
  const isMCQ = (row.question_type ?? row.type ?? "mcq").toLowerCase() === "mcq";
  return {
    subject: row.subject ?? "Physics",
    question_type: isMCQ ? "mcq" : "numerical",
    question_text: row.question_text ?? row.question ?? "",
    image_url: row.image_url || null,
    option_a: row.option_a || row.a || null,
    option_b: row.option_b || row.b || null,
    option_c: row.option_c || row.c || null,
    option_d: row.option_d || row.d || null,
    correct_option: isMCQ ? ((row.correct_option || row.answer || "A").trim().toUpperCase()) : null,
    correct_numerical: !isMCQ ? toNumber(row.correct_numerical ?? row.answer ?? "") : null,
    tolerance: toNumber(row.tolerance ?? "0") ?? 0,
    marks_correct: toNumber(row.marks_correct ?? "4") ?? 4,
    marks_wrong: toNumber(row.marks_wrong ?? (isMCQ ? "-1" : "0")) ?? 0,
  };
}

export default function BulkImport({ onDone, onClose }: Props) {
  const [preview, setPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number } | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        let questions: any[];
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          questions = Array.isArray(parsed) ? parsed : parsed.questions ?? [];
        } else {
          const rows = parseCSV(text);
          questions = rows.map(csvRowToQuestion);
        }
        setPreview(questions.slice(0, 500));
      } catch (err: any) {
        setError("Failed to parse file: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  async function doImport() {
    if (preview.length === 0) return;
    setImporting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/questions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: preview }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ inserted: data.inserted });
      } else {
        if (data.details && Array.isArray(data.details)) {
          const detailMsgs = data.details.slice(0, 5).map((d: any) => {
            const fieldKeys = Object.keys(d.error?.fieldErrors ?? {});
            const fieldMsg = fieldKeys.map((k) => `${k}: ${(d.error.fieldErrors[k] || []).join(", ")}`).join("; ");
            return `Question #${d.index + 1}: ${fieldMsg || "Invalid format"}`;
          });
          setError(`Validation errors (${data.details.length} questions):\n` + detailMsgs.join("\n"));
        } else if (typeof data.error === "string" && data.error.includes("row-level security")) {
          setError(
            "Supabase Row Level Security (RLS) blocked this insert.\n" +
            "Please run this in your Supabase SQL Editor:\n" +
            "ALTER TABLE questions DISABLE ROW LEVEL SECURITY;\n" +
            "ALTER TABLE tests DISABLE ROW LEVEL SECURITY;"
          );
        } else {
          setError(typeof data.error === "string" ? data.error : "Import failed. Please check file format.");
        }
      }
    } catch (e: any) {
      setError("Network error: " + e.message);
    }
    setImporting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-lg text-gray-900">Bulk Import Questions</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
            <p className="font-medium">Accepted formats:</p>
            <p><strong>CSV</strong> — columns: <code>subject, question_type, question_text, option_a, option_b, option_c, option_d, correct_option, correct_numerical, tolerance, marks_correct, marks_wrong, image_url</code></p>
            <p><strong>JSON</strong> — array of objects with the same field names</p>
            <p className="text-xs text-blue-600">question_type: "mcq" or "numerical" | correct_option: A/B/C/D | subject: Physics/Chemistry/Maths</p>
          </div>

          {!result && (
            <>
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-gray-600 font-medium">Click to upload CSV or JSON file</p>
                <p className="text-xs text-gray-400 mt-1">Max 500 questions</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={handleFile} />
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 whitespace-pre-wrap font-mono">
              {error}
            </div>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-center">
              <p className="font-bold text-lg">✓ {result.inserted} questions imported!</p>
              <button onClick={onDone} className="btn-success mt-3">Done</button>
            </div>
          )}

          {preview.length > 0 && !result && (
            <>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Preview ({preview.length} questions found):
                </p>
                <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-600">#</th>
                        <th className="text-left px-3 py-2 text-gray-600">Subject</th>
                        <th className="text-left px-3 py-2 text-gray-600">Type</th>
                        <th className="text-left px-3 py-2 text-gray-600">Question</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((q, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2">{q.subject}</td>
                          <td className="px-3 py-2 uppercase">{q.question_type}</td>
                          <td className="px-3 py-2 max-w-xs truncate">{q.question_text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button onClick={onClose} className="btn-secondary">Cancel</button>
                <button
                  onClick={doImport}
                  disabled={importing}
                  id="import-btn"
                  className="btn-primary"
                >
                  {importing ? "Importing…" : `Import ${preview.length} Questions`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
