-- =====================================================
-- JEE Mock Test Platform — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- =====================================================

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL CHECK (subject IN ('Physics', 'Chemistry', 'Maths')),
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'numerical')),
  question_text TEXT NOT NULL,
  image_url TEXT,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  option_a_image TEXT,
  option_b_image TEXT,
  option_c_image TEXT,
  option_d_image TEXT,
  correct_option TEXT CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  correct_numerical NUMERIC,
  tolerance NUMERIC DEFAULT 0,
  marks_correct NUMERIC NOT NULL DEFAULT 4,
  marks_wrong NUMERIC NOT NULL DEFAULT -1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tests table
CREATE TABLE IF NOT EXISTS tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  test_code TEXT UNIQUE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 180,
  results_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test questions (junction table with ordering)
CREATE TABLE IF NOT EXISTS test_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  UNIQUE(test_id, question_order),
  UNIQUE(test_id, question_id)
);

-- Attempts table
CREATE TABLE IF NOT EXISTS attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  answers JSONB DEFAULT '{}',
  start_time TIMESTAMPTZ DEFAULT NOW(),
  submit_time TIMESTAMPTZ,
  status TEXT DEFAULT 'in-progress' CHECK (status IN ('in-progress', 'submitted')),
  score NUMERIC,
  correct_count INTEGER,
  wrong_count INTEGER,
  unattempted_count INTEGER,
  subject_scores JSONB DEFAULT '{}',
  UNIQUE(test_id, student_name)
);

-- =====================================================
-- Disable RLS (this is a private app with ~5 users)
-- The publishable key will have full CRUD access
-- =====================================================
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE attempts DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- Useful indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_test_questions_test_id ON test_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_attempts_test_id ON attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(question_type);
