/**
 * Seed script to populate Supabase with the 21 sample JEE questions.
 * Run with: node scripts/seed.js
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local manually if dotenv is not installed
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pubKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const apiKey = (svcKey && svcKey !== 'your_service_role_key_here') ? svcKey : pubKey;

if (!supabaseUrl || !apiKey) {
  console.error('❌ Missing Supabase URL or Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, apiKey);

function normalize(raw) {
  const get = (...keys) => {
    for (const k of keys) if (raw[k] !== undefined) return raw[k];
    return undefined;
  };
  return {
    subject: get('subject'),
    question_type: get('question_type', 'questionType'),
    question_text: get('question_text', 'questionText'),
    image_url: get('image_url', 'imageUrl') || null,
    option_a: get('option_a', 'optionA') || null,
    option_b: get('option_b', 'optionB') || null,
    option_c: get('option_c', 'optionC') || null,
    option_d: get('option_d', 'optionD') || null,
    correct_option: get('correct_option', 'correctOption') || null,
    correct_numerical: get('correct_numerical', 'correctNumerical') ?? null,
    tolerance: get('tolerance') ?? 0,
    marks_correct: get('marks_correct', 'marksCorrect') ?? 4,
    marks_wrong: get('marks_wrong', 'marksWrong') ?? -1,
  };
}

async function seed() {
  const questionsPath = path.join(__dirname, '..', 'sample_questions.json');
  if (!fs.existsSync(questionsPath)) {
    console.error('❌ sample_questions.json not found at', questionsPath);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
  const normalized = raw.map(normalize);
  console.log(`Found ${normalized.length} questions to import...`);

  const { data, error } = await supabase.from('questions').insert(normalized).select('id');

  if (error) {
    console.error('\n❌ Import failed:', error.message);
    if (error.message.includes('row-level security') || error.code === '42501') {
      console.log('\n🔒 Row Level Security (RLS) is currently enabled in your Supabase project.');
      console.log('To allow your app and this script to insert questions, do EITHER of the following:');
      console.log('\n👉 OPTION A (Quickest — Run in Supabase SQL Editor):');
      console.log('   ALTER TABLE questions DISABLE ROW LEVEL SECURITY;');
      console.log('   ALTER TABLE tests DISABLE ROW LEVEL SECURITY;');
      console.log('   ALTER TABLE test_questions DISABLE ROW LEVEL SECURITY;');
      console.log('   ALTER TABLE attempts DISABLE ROW LEVEL SECURITY;');
      console.log('\n👉 OPTION B:');
      console.log('   Go to Supabase Dashboard > Project Settings > API > copy "service_role" secret key');
      console.log('   Paste it into .env.local as: SUPABASE_SERVICE_ROLE_KEY=ey...');
    }
    process.exit(1);
  }

  console.log(`\n🎉 Success! Successfully inserted ${data.length} questions into Supabase!`);
}

seed();
