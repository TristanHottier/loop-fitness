#!/usr/bin/env node
// scripts/verify-musclemap.mjs
//
// Verifies the four generated MuscleMap JSON assets:
//   1. Each file parses as valid JSON.
//   2. Required top-level fields (gender, side, viewBox, parts) are present.
//   3. Required per-part fields are present.
//   4. `order` is a 0-based sequential index.
//   5. Every path string appears VERBATIM (byte-for-byte) in its source Swift
//      file (guards against any trimming/alteration).
//   6. Part counts match the expected values.
//
// Usage:  node scripts/verify-musclemap.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const SRC =
  'C:\\Users\\trist\\AppData\\Local\\Temp\\opencode\\MuscleMap\\Sources\\MuscleMap\\Data';
const OUT = join(repoRoot, 'app', 'src', 'assets', 'musclemap');

const FILES = [
  { out: 'male-front.json', src: 'MaleFrontPaths.swift', expectedParts: 28 },
  { out: 'male-back.json', src: 'MaleBackPaths.swift', expectedParts: 16 },
  { out: 'female-front.json', src: 'FemaleFrontPaths.swift', expectedParts: 28 },
  { out: 'female-back.json', src: 'FemaleBackPaths.swift', expectedParts: 14 },
];

const TOP_FIELDS = ['gender', 'side', 'viewBox', 'parts'];
const PART_FIELDS = [
  'slug',
  'parent',
  'alwaysVisible',
  'isMuscle',
  'order',
  'common',
  'left',
  'right',
];

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.log('  FAIL: ' + msg);
};

for (const f of FILES) {
  const docPath = join(OUT, f.out);
  let doc;
  try {
    doc = JSON.parse(readFileSync(docPath, 'utf8'));
  } catch (e) {
    fail(`${f.out} did not parse: ${e.message}`);
    continue;
  }

  const src = readFileSync(join(SRC, f.src), 'utf8');

  for (const k of TOP_FIELDS) {
    if (!(k in doc)) fail(`${f.out} missing top-level field "${k}"`);
  }

  if (doc.parts.length !== f.expectedParts) {
    fail(`${f.out} part count ${doc.parts.length} != expected ${f.expectedParts}`);
  }

  let pathStrings = 0;
  doc.parts.forEach((p, i) => {
    for (const k of PART_FIELDS) {
      if (!(k in p)) fail(`${f.out} part "${p.slug}" missing field "${k}"`);
    }
    if (p.order !== i) fail(`${f.out} part "${p.slug}" order ${p.order} != index ${i}`);
    for (const arr of [p.common, p.left, p.right]) {
      if (!Array.isArray(arr)) {
        fail(`${f.out} part "${p.slug}" has non-array path field`);
        continue;
      }
      for (const s of arr) {
        pathStrings += 1;
        if (!src.includes('"' + s + '"')) {
          fail(
            `${f.out} part "${p.slug}" path not found verbatim in source: ${s.slice(0, 40)}...`,
          );
        }
      }
    }
  });

  console.log(
    `  ${f.out.padEnd(16)} parts=${String(doc.parts.length).padStart(2)}  ` +
      `pathStrings=${String(pathStrings).padStart(3)}  viewBox=${JSON.stringify(doc.viewBox)}`,
  );
}

if (failures === 0) {
  console.log('\nALL CHECKS PASSED');
} else {
  console.log(`\n${failures} CHECK(S) FAILED`);
  process.exitCode = 1;
}
