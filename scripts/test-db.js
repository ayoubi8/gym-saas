#!/usr/bin/env node
/**
 * test-db.js — Phase 1A SQL test runner
 * Runs all supabase/tests/*.sql files in order against the local Supabase DB.
 * Usage: node scripts/test-db.js
 * Requires: DATABASE_URL env var or defaults to local Supabase URL.
 * Exits non-zero on first failure.
 *
 * For Supabase local dev: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
 */

import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root      = resolve(__dirname, '..');
const testsDir  = join(root, 'supabase', 'tests');

const DB_URL = process.env.DATABASE_URL
  || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const files = readdirSync(testsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error('No SQL test files found in supabase/tests/');
  process.exit(1);
}

console.log(`Running ${files.length} SQL test file(s) against: ${DB_URL}\n`);

let passed = 0;
for (const file of files) {
  const path = join(testsDir, file);
  console.log(`--- ${file} ---`);
  try {
    const output = execSync(`psql "${DB_URL}" -f "${path}" -v ON_ERROR_STOP=1`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(output);
    passed++;
  } catch (err) {
    console.error(`\nFAILED: ${file}`);
    console.error(err.stdout || '');
    console.error(err.stderr || '');
    process.exit(1);
  }
}

console.log(`\n✓ All ${passed}/${files.length} test files passed.`);
