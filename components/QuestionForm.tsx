"use client";
import { useState, useRef } from "react";

interface Props {
  initial?: any;
  onSave: () => void;
  onClose: () => void;
}

// Upload via our server-side signed route — API secret never leaves the server
async function uploadToCloudinary(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error ?? "Image upload failed");
  }
  const data = await res.json();
  return data.url;
}

function ImageUpload({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const url = await uploadToCloudinary(file);
      onChange(url);
    } catch (err: any) {
      setUploadError(err.message);
    }
    setUploading(false);
  }

  return (
    <div className="space-y-1">
      <label className="label">{label}</label>
      <div className="flex gap-2 items-center">
        <input
          type="url"
          className="input text-sm"
          placeholder="https://... or upload below"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="btn-secondary text-xs px-3 py-2 shrink-0"
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
      {value && (
        <img src={value} alt="preview" className="mt-2 max-h-24 rounded border border-gray-200" />
      )}
    </div>
  );
}

export default function QuestionForm({ initial, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    subject: initial?.subject ?? "Physics",
    question_type: initial?.question_type ?? "mcq",
    question_text: initial?.question_text ?? "",
    image_url: initial?.image_url ?? "",
    option_a: initial?.option_a ?? "",
    option_b: initial?.option_b ?? "",
    option_c: initial?.option_c ?? "",
    option_d: initial?.option_d ?? "",
    option_a_image: initial?.option_a_image ?? "",
    option_b_image: initial?.option_b_image ?? "",
    option_c_image: initial?.option_c_image ?? "",
    option_d_image: initial?.option_d_image ?? "",
    correct_option: initial?.correct_option ?? "A",
    correct_numerical: initial?.correct_numerical ?? "",
    tolerance: initial?.tolerance ?? "0",
    marks_correct: initial?.marks_correct ?? 4,
    marks_wrong: initial?.marks_wrong ?? -1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const body: any = {
      subject: form.subject,
      question_type: form.question_type,
      question_text: form.question_text,
      image_url: form.image_url || null,
      marks_correct: Number(form.marks_correct),
      marks_wrong: Number(form.marks_wrong),
    };

    if (form.question_type === "mcq") {
      body.option_a = form.option_a || null;
      body.option_b = form.option_b || null;
      body.option_c = form.option_c || null;
      body.option_d = form.option_d || null;
      body.option_a_image = form.option_a_image || null;
      body.option_b_image = form.option_b_image || null;
      body.option_c_image = form.option_c_image || null;
      body.option_d_image = form.option_d_image || null;
      body.correct_option = form.correct_option;
      body.correct_numerical = null;
      body.tolerance = null;
    } else {
      body.correct_numerical = Number(form.correct_numerical);
      body.tolerance = Number(form.tolerance) || 0;
      body.correct_option = null;
    }

    const url = initial ? `/api/admin/questions/${initial.id}` : "/api/admin/questions";
    const method = initial ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      onSave();
    } else {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-lg text-gray-900">
            {initial ? "Edit Question" : "Add Question"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Subject</label>
              <select className="input" value={form.subject} onChange={(e) => set("subject", e.target.value)}>
                <option>Physics</option>
                <option>Chemistry</option>
                <option>Maths</option>
              </select>
            </div>
            <div>
              <label className="label">Question Type</label>
              <select className="input" value={form.question_type} onChange={(e) => set("question_type", e.target.value)}>
                <option value="mcq">MCQ</option>
                <option value="numerical">Numerical / Integer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Question Text *</label>
            <textarea
              className="input min-h-[80px]"
              value={form.question_text}
              onChange={(e) => set("question_text", e.target.value)}
              placeholder="Enter question..."
              required
            />
          </div>

          <ImageUpload
            label="Question Image (optional)"
            value={form.image_url}
            onChange={(url) => set("image_url", url)}
          />

          {form.question_type === "mcq" ? (
            <>
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Options</p>
                {(["a", "b", "c", "d"] as const).map((opt) => (
                  <div key={opt} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                        {opt.toUpperCase()}
                      </span>
                      <input
                        type="text"
                        className="input"
                        value={(form as any)[`option_${opt}`]}
                        onChange={(e) => set(`option_${opt}`, e.target.value)}
                        placeholder={`Option ${opt.toUpperCase()}`}
                      />
                    </div>
                    <ImageUpload
                      label={`Option ${opt.toUpperCase()} Image (optional)`}
                      value={(form as any)[`option_${opt}_image`]}
                      onChange={(url) => set(`option_${opt}_image`, url)}
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="label">Correct Option *</label>
                <div className="flex gap-3">
                  {["A", "B", "C", "D"].map((opt) => (
                    <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="correct_option"
                        value={opt}
                        checked={form.correct_option === opt}
                        onChange={() => set("correct_option", opt)}
                        className="accent-blue-600"
                      />
                      <span className="text-sm font-medium">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Correct Answer *</label>
                <input
                  type="number"
                  step="any"
                  className="input"
                  value={form.correct_numerical}
                  onChange={(e) => set("correct_numerical", e.target.value)}
                  placeholder="e.g. 4.5"
                  required
                />
              </div>
              <div>
                <label className="label">Tolerance (±)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="input"
                  value={form.tolerance}
                  onChange={(e) => set("tolerance", e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Marks for Correct</label>
              <input
                type="number"
                step="any"
                className="input"
                value={form.marks_correct}
                onChange={(e) => set("marks_correct", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Marks for Wrong</label>
              <input
                type="number"
                step="any"
                className="input"
                value={form.marks_wrong}
                onChange={(e) => set("marks_wrong", e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              type="submit"
              id="save-question-btn"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Saving…" : initial ? "Update Question" : "Save Question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
