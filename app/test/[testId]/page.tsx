"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  subject: string;
  question_type: "mcq" | "numerical";
  question_text: string;
  image_url?: string | null;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  option_a_image?: string | null;
  option_b_image?: string | null;
  option_c_image?: string | null;
  option_d_image?: string | null;
  marks_correct: number;
  marks_wrong: number;
  order: number;
}

interface Answer {
  selected_option?: string | null;
  entered_number?: number | null;
  marked_for_review?: boolean;
}

type PaletteStatus = "not_visited" | "not_answered" | "answered" | "marked" | "answered_marked";

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = (testId: string) => `jee_attempt_${testId}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPaletteStatus(qId: string, ans: Answer | undefined, visitedIds: Set<string>): PaletteStatus {
  const hasAnswer = ans?.selected_option || (ans?.entered_number !== undefined && ans.entered_number !== null && ans.entered_number !== undefined);
  const marked = ans?.marked_for_review ?? false;
  if (!visitedIds.has(qId)) return "not_visited";
  if (hasAnswer && marked) return "answered_marked";
  if (hasAnswer) return "answered";
  if (marked) return "marked";
  return "not_answered";
}

function paletteClass(status: PaletteStatus): string {
  switch (status) {
    case "not_visited": return "palette-not-visited";
    case "not_answered": return "palette-not-answered";
    case "answered": return "palette-answered";
    case "marked": return "palette-marked";
    case "answered_marked": return "palette-answered-marked";
  }
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TestPage() {
  const { testId } = useParams<{ testId: string }>();
  const [phase, setPhase] = useState<"entry" | "loading" | "test" | "submitted" | "results">("entry");

  // Entry form
  const [studentName, setStudentName] = useState("");
  const [testCode, setTestCode] = useState("");
  const [entryError, setEntryError] = useState("");
  const [entryLoading, setEntryLoading] = useState(false);

  // Attempt state
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [testTitle, setTestTitle] = useState("");
  const [showPalette, setShowPalette] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultsPublished, setResultsPublished] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Autosave debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmittedRef = useRef(false);

  // ─── On mount: check for saved session ───────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY(testId));
    if (saved) {
      try {
        const { attemptId: aid, studentName: sn } = JSON.parse(saved);
        if (aid && sn) {
          // Auto-resume
          resumeSession(aid, sn);
        }
      } catch { /* ignore */ }
    }
  }, [testId]);

  async function resumeSession(aid: string, sn: string) {
    setPhase("loading");
    try {
      const res = await fetch(`/api/test/${testId}/status?attempt_id=${aid}`);
      if (!res.ok) {
        // Session invalid, go back to entry
        localStorage.removeItem(STORAGE_KEY(testId));
        setPhase("entry");
        return;
      }
      const data = await res.json();

      if (data.status === "submitted") {
        setStudentName(sn);
        setAttemptId(aid);
        setResultsPublished(data.results_published);
        setPhase(data.results_published ? "results" : "submitted");
        return;
      }

      // Resume active test
      setAttemptId(aid);
      setStudentName(sn);
      setTestTitle(data.test_title);
      setTimeRemaining(data.time_remaining_seconds);
      setAnswers(data.answers ?? {});

      // Load questions
      await loadQuestions(aid);
    } catch {
      localStorage.removeItem(STORAGE_KEY(testId));
      setPhase("entry");
    }
  }

  async function loadQuestions(aid: string) {
    const res = await fetch(`/api/test/${testId}/questions?attemptId=${aid}`);
    if (!res.ok) { setPhase("entry"); return; }
    const data = await res.json();
    setQuestions(data.questions ?? []);
    if (data.questions?.length > 0) {
      setVisitedIds(new Set([data.questions[0].id]));
    }
    setPhase("test");
  }

  // ─── Entry: Start / Resume ────────────────────────────────────────────────

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setEntryError("");
    setEntryLoading(true);

    const res = await fetch(`/api/test/${testId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_name: studentName.trim(), test_code: testCode.trim() }),
    });

    const data = await res.json();

    if (!res.ok) {
      setEntryError(data.error ?? "Failed to start test");
      setEntryLoading(false);
      return;
    }

    const attempt = data.attempt;

    // Save to localStorage for resume
    localStorage.setItem(STORAGE_KEY(testId), JSON.stringify({
      attemptId: attempt.id,
      studentName: studentName.trim(),
    }));

    if (data.status === "already_submitted") {
      setAttemptId(attempt.id);
      setResultsPublished(false);
      setPhase("submitted");
      setEntryLoading(false);
      return;
    }

    if (data.status === "results_published") {
      setAttemptId(attempt.id);
      setResultsPublished(true);
      setPhase("results");
      setEntryLoading(false);
      return;
    }

    if (data.status === "time_expired") {
      setAttemptId(attempt.id);
      setResultsPublished(false);
      setPhase("submitted");
      setEntryLoading(false);
      return;
    }

    // started or resumed
    setAttemptId(attempt.id);
    setTestTitle(data.test_title ?? "");
    setTimeRemaining(data.time_remaining_seconds ?? 0);
    setAnswers(attempt.answers ?? {});
    await loadQuestions(attempt.id);
    setEntryLoading(false);
  }

  // ─── Timer ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "test" || timeRemaining <= 0) return;
    const interval = setInterval(() => {
      setTimeRemaining((t) => {
        if (t <= 1) {
          clearInterval(interval);
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            handleSubmit(true);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // ─── Autosave ─────────────────────────────────────────────────────────────

  const saveAnswer = useCallback(
    async (questionId: string, answer: Answer) => {
      if (!attemptId) return;
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/test/${testId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attempt_id: attemptId,
            question_id: questionId,
            ...answer,
          }),
        });
        const data = await res.json();
        if (data.auto_submitted && !autoSubmittedRef.current) {
          autoSubmittedRef.current = true;
          handleSubmit(true);
          return;
        }
        setSaveStatus(res.ok ? "saved" : "error");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    },
    [attemptId, testId]
  );

  function debouncedSave(questionId: string, answer: Answer) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveAnswer(questionId, answer), 800);
  }

  // ─── Answer handling ──────────────────────────────────────────────────────

  function handleSelectOption(qId: string, option: string) {
    const updated = { ...answers[qId], selected_option: option };
    setAnswers((prev) => ({ ...prev, [qId]: updated }));
    debouncedSave(qId, updated);
  }

  function handleEnterNumber(qId: string, value: string) {
    const num = value === "" ? null : parseFloat(value);
    const updated = { ...answers[qId], entered_number: num };
    setAnswers((prev) => ({ ...prev, [qId]: updated }));
    debouncedSave(qId, updated);
  }

  function handleClearResponse(qId: string) {
    const updated: Answer = { ...answers[qId], selected_option: null, entered_number: null };
    setAnswers((prev) => ({ ...prev, [qId]: updated }));
    saveAnswer(qId, updated);
  }

  function handleMarkForReview(qId: string) {
    const updated = { ...answers[qId], marked_for_review: !answers[qId]?.marked_for_review };
    setAnswers((prev) => ({ ...prev, [qId]: updated }));
    saveAnswer(qId, updated);
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  function goTo(idx: number) {
    const q = questions[idx];
    if (q) {
      setVisitedIds((prev) => new Set([...prev, q.id]));
      setCurrentIdx(idx);
      setShowPalette(false);
    }
  }

  function saveAndNext() {
    if (currentIdx < questions.length - 1) goTo(currentIdx + 1);
  }

  function markAndNext() {
    const qId = questions[currentIdx]?.id;
    if (qId) handleMarkForReview(qId);
    if (currentIdx < questions.length - 1) goTo(currentIdx + 1);
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(isAutoSubmit = false) {
    if (!attemptId) return;
    setSubmitting(true);
    setShowSubmitConfirm(false);
    try {
      const res = await fetch(`/api/test/${testId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt_id: attemptId }),
      });
      if (res.ok) {
        setPhase("submitted");
      } else {
        alert("Submission failed. Please try again.");
      }
    } catch {
      alert("Network error during submission. Please retry.");
    }
    setSubmitting(false);
  }

  // ─── Results polling ──────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "submitted" || !attemptId) return;
    // Poll every 10s to check if results published
    const interval = setInterval(async () => {
      const res = await fetch(`/api/test/${testId}/status?attempt_id=${attemptId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.results_published) {
          setResultsPublished(true);
          setPhase("results");
          clearInterval(interval);
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [phase, attemptId, testId]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (phase === "entry") {
    return <EntryScreen
      testId={testId}
      studentName={studentName}
      setStudentName={setStudentName}
      testCode={testCode}
      setTestCode={setTestCode}
      error={entryError}
      loading={entryLoading}
      onSubmit={handleStart}
    />;
  }

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading your test…</p>
        </div>
      </div>
    );
  }

  if (phase === "submitted") {
    return <SubmittedScreen
      testId={testId}
      attemptId={attemptId!}
      onResultsAvailable={() => { setResultsPublished(true); setPhase("results"); }}
    />;
  }

  if (phase === "results") {
    return <ResultsScreen testId={testId} attemptId={attemptId!} studentName={studentName} />;
  }

  // ─── Test Interface ───────────────────────────────────────────────────────

  const currentQuestion = questions[currentIdx];
  if (!currentQuestion) return null;

  const currentAnswer = answers[currentQuestion.id];
  const unansweredCount = questions.filter((q) => {
    const a = answers[q.id];
    return !a?.selected_option && (a?.entered_number === undefined || a?.entered_number === null);
  }).length;

  const isLowTime = timeRemaining <= 300;

  // Group questions by subject for palette
  const subjectGroups: Record<string, Question[]> = {};
  for (const q of questions) {
    if (!subjectGroups[q.subject]) subjectGroups[q.subject] = [];
    subjectGroups[q.subject].push(q);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="min-w-0">
          <h1 className="font-bold text-gray-900 text-sm sm:text-base truncate">{testTitle || "JEE Mock Test"}</h1>
          <p className="text-xs text-gray-500">{studentName}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Save status */}
          <span className={`text-xs hidden sm:inline ${saveStatus === "saving" ? "text-orange-500" : saveStatus === "saved" ? "text-green-600" : saveStatus === "error" ? "text-red-600" : "text-gray-400"}`}>
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : saveStatus === "error" ? "⚠ Save failed" : ""}
          </span>

          {/* Timer */}
          <div className={`px-3 py-1.5 rounded-lg font-mono font-bold text-sm ${
            isLowTime ? "timer-warning text-red-700" : "bg-gray-100 text-gray-700"
          }`}>
            {formatTime(timeRemaining)}
          </div>

          {/* Palette toggle on mobile */}
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="sm:hidden btn-secondary text-xs px-3 py-1.5"
          >
            ☰
          </button>

          <button
            onClick={() => setShowSubmitConfirm(true)}
            id="submit-test-btn"
            className="btn-primary text-sm py-1.5"
          >
            Submit
          </button>
        </div>
      </div>

      <div className="flex flex-1 max-w-6xl mx-auto w-full px-4 py-4 gap-4">
        {/* Question area */}
        <div className="flex-1 min-w-0">
          {/* Subject tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto">
            {Object.keys(subjectGroups).map((subj) => {
              const inSubj = subjectGroups[subj].some((q) => q.id === currentQuestion.id);
              return (
                <button
                  key={subj}
                  onClick={() => {
                    const firstQ = subjectGroups[subj][0];
                    const idx = questions.findIndex((q) => q.id === firstQ.id);
                    goTo(idx);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                    inSubj ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  }`}
                >
                  {subj}
                </button>
              );
            })}
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium">
                Q{currentIdx + 1} of {questions.length}
              </span>
              <span className="text-xs text-gray-500">{currentQuestion.subject}</span>
              <span className="text-xs text-gray-400 uppercase">{currentQuestion.question_type}</span>
              <span className="text-xs text-gray-400 ml-auto">
                +{currentQuestion.marks_correct} / {currentQuestion.marks_wrong}
              </span>
            </div>

            {/* Question text */}
            <p className="text-base text-gray-900 leading-relaxed mb-4 whitespace-pre-wrap">
              {currentQuestion.question_text}
            </p>
            {currentQuestion.image_url && (
              <img
                src={currentQuestion.image_url}
                alt="Question diagram"
                className="max-w-full rounded-lg border border-gray-200 mb-4"
              />
            )}

            {/* MCQ options */}
            {currentQuestion.question_type === "mcq" && (
              <div className="space-y-3">
                {(["A", "B", "C", "D"] as const).map((opt) => {
                  const text = (currentQuestion as any)[`option_${opt.toLowerCase()}`];
                  const img = (currentQuestion as any)[`option_${opt.toLowerCase()}_image`];
                  if (!text && !img) return null;
                  const selected = currentAnswer?.selected_option === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => handleSelectOption(currentQuestion.id, opt)}
                      className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border-2 transition-all ${
                        selected
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 ${
                        selected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                      }`}>
                        {opt}
                      </span>
                      <div className="flex-1 min-w-0">
                        {text && <p className="text-sm text-gray-800">{text}</p>}
                        {img && <img src={img} alt={`Option ${opt}`} className="mt-1 max-h-20 rounded" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Numerical input */}
            {currentQuestion.question_type === "numerical" && (
              <div>
                <label className="label">Enter your answer:</label>
                <input
                  type="number"
                  step="any"
                  className="input text-lg font-mono max-w-xs"
                  value={currentAnswer?.entered_number ?? ""}
                  onChange={(e) => handleEnterNumber(currentQuestion.id, e.target.value)}
                  placeholder="Enter number..."
                  id={`numerical-input-${currentIdx}`}
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => handleMarkForReview(currentQuestion.id)}
              className={`btn-secondary text-sm ${currentAnswer?.marked_for_review ? "!bg-purple-50 !border-purple-300 !text-purple-700" : ""}`}
            >
              {currentAnswer?.marked_for_review ? "✓ Marked" : "Mark for Review"}
            </button>
            <button
              onClick={() => handleClearResponse(currentQuestion.id)}
              className="btn-secondary text-sm"
            >
              Clear Response
            </button>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => currentIdx > 0 && goTo(currentIdx - 1)}
                disabled={currentIdx === 0}
                className="btn-secondary text-sm disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                onClick={markAndNext}
                className="btn-secondary text-sm"
                disabled={currentIdx === questions.length - 1}
              >
                Mark & Next
              </button>
              <button
                onClick={saveAndNext}
                className="btn-primary text-sm"
                disabled={currentIdx === questions.length - 1}
              >
                Save & Next →
              </button>
            </div>
          </div>
        </div>

        {/* Palette — desktop sidebar */}
        <div className="hidden sm:block w-64 shrink-0">
          <PalettePanel
            questions={questions}
            answers={answers}
            visitedIds={visitedIds}
            currentIdx={currentIdx}
            onGoTo={goTo}
          />
        </div>
      </div>

      {/* Mobile palette overlay */}
      {showPalette && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:hidden">
          <div className="bg-white rounded-t-2xl w-full p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-800">Question Palette</h3>
              <button onClick={() => setShowPalette(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <PalettePanel
              questions={questions}
              answers={answers}
              visitedIds={visitedIds}
              currentIdx={currentIdx}
              onGoTo={(idx) => { goTo(idx); setShowPalette(false); }}
            />
          </div>
        </div>
      )}

      {/* Submit confirmation */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-lg text-gray-900 mb-2">Submit Test?</h3>
            <p className="text-sm text-gray-500 mb-4">
              {unansweredCount > 0
                ? `You have ${unansweredCount} unanswered question${unansweredCount > 1 ? "s" : ""}. Are you sure you want to submit?`
                : "All questions are answered. Ready to submit?"}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="btn-secondary flex-1"
              >
                Continue Test
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                id="confirm-submit-btn"
                className="btn-danger flex-1"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Palette Panel ────────────────────────────────────────────────────────────

function PalettePanel({
  questions,
  answers,
  visitedIds,
  currentIdx,
  onGoTo,
}: {
  questions: Question[];
  answers: Record<string, Answer>;
  visitedIds: Set<string>;
  currentIdx: number;
  onGoTo: (idx: number) => void;
}) {
  const subjects = [...new Set(questions.map((q) => q.subject))];
  const counts = {
    not_visited: 0, not_answered: 0, answered: 0, marked: 0, answered_marked: 0,
  };
  questions.forEach((q) => {
    counts[getPaletteStatus(q.id, answers[q.id], visitedIds)]++;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Legend */}
      <div className="grid grid-cols-2 gap-1 mb-4 text-xs">
        {([
          ["palette-not-visited", "Not Visited"],
          ["palette-not-answered", "Not Answered"],
          ["palette-answered", "Answered"],
          ["palette-marked", "Marked"],
          ["palette-answered-marked", "Ans + Marked"],
        ] as const).map(([cls, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded-sm ${cls}`} />
            <span className="text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      {/* Questions by subject */}
      {subjects.map((subj) => (
        <div key={subj} className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{subj}</p>
          <div className="flex flex-wrap gap-1.5">
            {questions
              .filter((q) => q.subject === subj)
              .map((q) => {
                const idx = questions.indexOf(q);
                const status = getPaletteStatus(q.id, answers[q.id], visitedIds);
                return (
                  <button
                    key={q.id}
                    onClick={() => onGoTo(idx)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${paletteClass(status)} ${
                      idx === currentIdx ? "ring-2 ring-blue-600 ring-offset-1" : ""
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Entry Screen ─────────────────────────────────────────────────────────────

function EntryScreen({
  testId, studentName, setStudentName, testCode, setTestCode, error, loading, onSubmit,
}: {
  testId: string;
  studentName: string;
  setStudentName: (v: string) => void;
  testCode: string;
  setTestCode: (v: string) => void;
  error: string;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">JEE Mock Test</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your details to begin</p>
        </div>

        <div className="card">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="student-name">Your Full Name</label>
              <input
                id="student-name"
                type="text"
                className="input"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                autoFocus
                required
                maxLength={100}
              />
            </div>
            <div>
              <label className="label" htmlFor="test-code-input">Test Code</label>
              <input
                id="test-code-input"
                type="text"
                className="input uppercase tracking-widest font-mono"
                value={testCode}
                onChange={(e) => setTestCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                maxLength={20}
                required
              />
              <p className="text-xs text-gray-400 mt-1">Get this from your teacher</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              id="start-test-btn"
              disabled={loading || !studentName.trim() || !testCode.trim()}
              className="btn-primary w-full"
            >
              {loading ? "Starting…" : "Start Test"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Submitted Screen ─────────────────────────────────────────────────────────

function SubmittedScreen({
  testId, attemptId, onResultsAvailable,
}: {
  testId: string;
  attemptId: string;
  onResultsAvailable: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Test Submitted!</h1>
        <p className="text-gray-500 text-sm mb-6">
          Your answers have been saved. Results will be published soon by your teacher. Check back on this page later.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-blue-700 text-sm font-medium">📩 How to see your results</p>
          <p className="text-blue-600 text-xs mt-1">
            Come back to this same link and enter your name + test code again once results are published.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────

function ResultsScreen({
  testId, attemptId, studentName,
}: {
  testId: string;
  attemptId: string;
  studentName: string;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewIdx, setReviewIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/test/${testId}/results?attempt_id=${attemptId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      });
  }, [testId, attemptId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Loading results…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card max-w-sm text-center">
        <p className="text-red-600">{error}</p>
      </div>
    </div>
  );

  const { attempt, questions, test } = data;
  const subjects = [...new Set(questions.map((q: any) => q.subject))];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-bold text-xl text-gray-900">{test.title} — Results</h1>
          <p className="text-sm text-gray-500">{attempt.student_name}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Score summary */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Overall Score</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Score", value: attempt.score, color: "text-blue-600 bg-blue-50" },
              { label: "Correct", value: attempt.correct_count, color: "text-green-600 bg-green-50" },
              { label: "Wrong", value: attempt.wrong_count, color: "text-red-600 bg-red-50" },
              { label: "Unattempted", value: attempt.unattempted_count, color: "text-gray-600 bg-gray-100" },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl p-4 text-center ${item.color.split(" ")[1]}`}>
                <p className={`text-3xl font-bold ${item.color.split(" ")[0]}`}>{item.value ?? "—"}</p>
                <p className="text-xs text-gray-500 mt-1">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Subject-wise */}
          {attempt.subject_scores && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Subject-wise Breakdown</p>
              <div className="space-y-2">
                {(subjects as string[]).map((subj: string) => {
                  const s = attempt.subject_scores?.[subj];
                  if (!s) return null;
                  return (
                    <div key={subj} className="flex items-center gap-4 text-sm">
                      <span className="w-20 font-medium text-gray-700">{subj}</span>
                      <span className="text-blue-600 font-semibold">{s.score ?? 0} pts</span>
                      <span className="text-green-600">{s.correct ?? 0} ✓</span>
                      <span className="text-red-600">{s.wrong ?? 0} ✗</span>
                      <span className="text-gray-400">{s.unattempted ?? 0} skipped</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Q-by-Q Review */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Question Review</h2>

          {/* Mini palette */}
          <div className="flex flex-wrap gap-1.5 mb-5 p-3 bg-gray-50 rounded-xl">
            {questions.map((q: any, i: number) => {
              const ans = attempt.answers?.[q.id] ?? {};
              let verdict = "unattempted";
              if (q.question_type === "mcq") {
                if (ans.selected_option) verdict = ans.selected_option === q.correct_option ? "correct" : "wrong";
              } else {
                if (ans.entered_number !== undefined && ans.entered_number !== null) {
                  const tol = q.tolerance ?? 0;
                  verdict = Math.abs(ans.entered_number - q.correct_numerical) <= tol ? "correct" : "wrong";
                }
              }
              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setReviewIdx(reviewIdx === i ? null : i);
                    setTimeout(() => document.getElementById(`review-q-${i}`)?.scrollIntoView({ behavior: "smooth" }), 50);
                  }}
                  className={`w-8 h-8 rounded-lg text-xs font-bold ${
                    verdict === "correct" ? "palette-answered" : verdict === "wrong" ? "palette-not-answered" : "palette-not-visited"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            {questions.map((q: any, i: number) => {
              const ans = attempt.answers?.[q.id] ?? {};
              let verdict: "correct" | "wrong" | "unattempted" = "unattempted";
              if (q.question_type === "mcq") {
                if (ans.selected_option) verdict = ans.selected_option === q.correct_option ? "correct" : "wrong";
              } else {
                if (ans.entered_number !== undefined && ans.entered_number !== null) {
                  const tol = q.tolerance ?? 0;
                  verdict = Math.abs(ans.entered_number - q.correct_numerical) <= tol ? "correct" : "wrong";
                }
              }

              const borderClass = verdict === "correct" ? "border-green-400" : verdict === "wrong" ? "border-red-400" : "border-gray-200";
              const bgClass = verdict === "correct" ? "bg-green-50" : verdict === "wrong" ? "bg-red-50" : "bg-gray-50";

              return (
                <div key={q.id} id={`review-q-${i}`} className={`border-l-4 ${borderClass} rounded-xl p-4 shadow-sm`}>
                  <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 flex-wrap">
                    <span className="font-bold">Q{i + 1}</span>
                    <span>{q.subject}</span>
                    <span className="uppercase">{q.question_type}</span>
                    <span className={`ml-auto font-semibold px-2 py-0.5 rounded-full ${
                      verdict === "correct" ? "bg-green-100 text-green-700"
                      : verdict === "wrong" ? "bg-red-100 text-red-700"
                      : "bg-gray-200 text-gray-600"
                    }`}>
                      {verdict === "correct" ? `+${q.marks_correct}` : verdict === "wrong" ? q.marks_wrong : "Skipped"}
                    </span>
                  </div>

                  <p className="text-sm text-gray-800 mb-3 whitespace-pre-wrap">{q.question_text}</p>
                  {q.image_url && <img src={q.image_url} alt="" className="max-h-32 rounded mb-3 border border-gray-200" />}

                  {q.question_type === "mcq" ? (
                    <div className="space-y-2">
                      {(["A", "B", "C", "D"] as const).map((opt) => {
                        const text = q[`option_${opt.toLowerCase()}`];
                        const img = q[`option_${opt.toLowerCase()}_image`];
                        if (!text && !img) return null;
                        const isCorrect = opt === q.correct_option;
                        const isSelected = ans.selected_option === opt;
                        return (
                          <div
                            key={opt}
                            className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                              isCorrect && isSelected ? "bg-green-100 border border-green-400"
                              : isCorrect ? "bg-green-50 border border-green-300"
                              : isSelected ? "bg-red-100 border border-red-400"
                              : "bg-gray-50"
                            }`}
                          >
                            <span className="font-bold w-5 shrink-0">{opt}.</span>
                            <div className="flex-1">
                              {text && <p>{text}</p>}
                              {img && <img src={img} alt={`Option ${opt}`} className="max-h-16 mt-1 rounded" />}
                            </div>
                            {isCorrect && <span className="text-green-600 text-xs shrink-0">✓ Correct</span>}
                            {isSelected && !isCorrect && <span className="text-red-600 text-xs shrink-0">✗ Your answer</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex gap-6 text-sm">
                      <div className={`px-3 py-1.5 rounded-lg ${verdict === "correct" ? "bg-green-100 text-green-700" : "bg-red-50 text-red-700"}`}>
                        <span className="font-medium">Your answer: </span>
                        {ans.entered_number !== undefined && ans.entered_number !== null ? ans.entered_number : "Not answered"}
                      </div>
                      <div className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg">
                        <span className="font-medium">Correct: </span>
                        {q.correct_numerical}
                        {q.tolerance > 0 && <span className="text-xs"> ±{q.tolerance}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
