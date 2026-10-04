#!/usr/bin/env node
// scripts/extract-musclemap.mjs
//
// Extracts MuscleMap body-part SVG path data from the SwiftUI SDK source files
// and emits static JSON assets for the React PWA.
//
// - No external dependencies (Node built-ins only).
// - Re-runnable: overwrites the four JSON outputs on every run.
// - Path strings are preserved byte-for-byte (no trimming/alteration).
//
// Usage:  node scripts/extract-musclemap.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// Read-only source directory (SwiftUI SDK).
const SOURCE_DIR =
  'C:\\Users\\trist\\AppData\\Local\\Temp\\opencode\\MuscleMap\\Sources\\MuscleMap\\Data';

// Output directory (the ONLY place under app/src we are allowed to write).
const OUT_DIR = join(repoRoot, 'app', 'src', 'assets', 'musclemap');

// ---------------------------------------------------------------------------
// Semantic metadata (independent of the path geometry).
// ---------------------------------------------------------------------------

// Sub-group (child) slug -> parent slug. Anything not listed here has parent null.
const PARENT_OF = {
  upperChest: 'chest',
  lowerChest: 'chest',
  innerQuad: 'quadriceps',
  outerQuad: 'quadriceps',
  hipFlexors: 'quadriceps',
  upperAbs: 'abs',
  lowerAbs: 'abs',
  frontDeltoid: 'deltoids',
  rearDeltoid: 'deltoids',
  upperTrapezius: 'trapezius',
  lowerTrapezius: 'trapezius',
  serratus: 'obliques',
  ankles: 'feet',
  adductors: 'hamstring',
  neck: 'head',
};

// alwaysVisible = true only for these slugs.
const ALWAYS_VISIBLE = new Set(['ankles', 'adductors', 'neck']);

// isMuscle = false for cosmetic (non-muscle) parts; true for everything else.
const NON_MUSCLE = new Set(['hair', 'head']);

// Per-body configuration: source file, output file, and viewBox.
const BODIES = [
  {
    file: 'MaleFrontPaths.swift',
    gender: 'male',
    side: 'front',
    viewBox: { x: 0, y: 95, width: 727, height: 1280 },
    out: 'male-front.json',
  },
  {
    file: 'MaleBackPaths.swift',
    gender: 'male',
    side: 'back',
    viewBox: { x: 718, y: 95, width: 727, height: 1280 },
    out: 'male-back.json',
  },
  {
    file: 'FemaleFrontPaths.swift',
    gender: 'female',
    side: 'front',
    viewBox: { x: 0, y: 0, width: 650, height: 1450 },
    out: 'female-front.json',
  },
  {
    file: 'FemaleBackPaths.swift',
    gender: 'female',
    side: 'back',
    viewBox: { x: 823, y: 0, width: 650, height: 1450 },
    out: 'female-back.json',
  },
];

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a MuscleMap Swift source file into an ordered list of body parts.
 *
 * The generated files are uniform: each entry is
 *   BodyPartPathData(
 *       slug: .X,
 *       common: [ "path", ... ],   // optional
 *       left:   [ "path", ... ],   // optional
 *       right:  [ "path", ... ]    // optional
 *   )
 * with exactly one double-quoted path string per line.
 *
 * Path strings are captured verbatim (between the first and last quote on the
 * line). SVG path data never contains a double quote, so this is safe.
 */
function parseSwiftBodyPartPaths(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let current = null;
  let currentArray = null; // 'common' | 'left' | 'right' | null

  const flush = () => {
    if (current && current.slug) entries.push(current);
    current = null;
    currentArray = null;
  };

  for (const line of lines) {
    // Start of a new entry.
    if (/BodyPartPathData\(/.test(line)) {
      flush();
      current = { slug: null, common: [], left: [], right: [] };
      currentArray = null;
      continue;
    }

    if (current === null) continue;

    // slug: .X
    const slugMatch = line.match(/slug:\s*\.(\w+)/);
    if (slugMatch) {
      current.slug = slugMatch[1];
      continue;
    }

    // Array openers: common: [ / left: [ / right: [
    const arrMatch = line.match(/^\s*(common|left|right):\s*\[/);
    if (arrMatch) {
      currentArray = arrMatch[1];
      continue;
    }

    // A quoted path-string line (one per line in the generated files).
    const strMatch = line.match(/^\s*"(.*)"\s*,?\s*$/);
    if (strMatch && currentArray !== null) {
      current[currentArray].push(strMatch[1]);
      continue;
    }

    // Array closer.
    if (/^\s*\]/.test(line)) {
      currentArray = null;
      continue;
    }
  }
  flush();

  return entries;
}

// ---------------------------------------------------------------------------
// Build + write outputs
// ---------------------------------------------------------------------------

function buildBodyDoc(body, entries) {
  const parts = entries.map((entry, order) => ({
    slug: entry.slug,
    parent: PARENT_OF[entry.slug] ?? null,
    alwaysVisible: ALWAYS_VISIBLE.has(entry.slug),
    isMuscle: !NON_MUSCLE.has(entry.slug),
    order,
    common: entry.common,
    left: entry.left,
    right: entry.right,
  }));

  return {
    gender: body.gender,
    side: body.side,
    viewBox: body.viewBox,
    parts,
  };
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  let totalPathStrings = 0;
  const report = [];

  for (const body of BODIES) {
    const srcPath = join(SOURCE_DIR, body.file);
    const text = readFileSync(srcPath, 'utf8');
    const entries = parseSwiftBodyPartPaths(text);
    const doc = buildBodyDoc(body, entries);

    const pathStrings = doc.parts.reduce(
      (n, p) => n + p.common.length + p.left.length + p.right.length,
      0,
    );
    totalPathStrings += pathStrings;

    const outPath = join(OUT_DIR, body.out);
    writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');

    report.push({
      file: body.out,
      source: body.file,
      parts: doc.parts.length,
      pathStrings,
    });
  }

  console.log('MuscleMap extraction complete\n');
  for (const r of report) {
    console.log(
      `  ${r.file.padEnd(16)}  parts=${String(r.parts).padStart(2)}  pathStrings=${String(
        r.pathStrings,
      ).padStart(3)}   (source: ${r.source})`,
    );
  }
  console.log(`\n  total path strings: ${totalPathStrings}`);
  console.log(`  output dir: ${OUT_DIR}`);
}

main();
