#!/usr/bin/env node
// scripts/verify-musclemap-preview.mjs
//
// Verifies docs/design-preview/musclemap-preview.html:
//   1. It is self-contained: no external <script src>, <link>, <img>, or
//      fetch()/import of remote resources.
//   2. The inlined `const DATA = {...}` parses as JSON-compatible JS and,
//      when re-serialized, matches the on-disk JSON assets exactly
//      (same bodies, same part counts, same path strings).
//
// Usage:  node scripts/verify-musclemap-preview.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const HTML = join(repoRoot, 'docs', 'design-preview', 'musclemap-preview.html');
const ASSET_DIR = join(repoRoot, 'app', 'src', 'assets', 'musclemap');

const html = readFileSync(HTML, 'utf8');
let failures = 0;
const fail = (m) => {
  failures += 1;
  console.log('  FAIL: ' + m);
};

// 1. Self-contained checks.
//    (The SVG namespace URI "http://www.w3.org/2000/svg" is a constant, not a
//     remote resource, so it is excluded from the remote-URL check.)
if (/<script[^>]+src\s*=/i.test(html)) fail('external <script src> found');
if (/<link[^>]+href\s*=/i.test(html)) fail('external <link href> found');
if (/<img[^>]+src\s*=/i.test(html)) fail('external <img src> found');
if (/\bfetch\s*\(/.test(html)) fail('fetch() call found');
if (/\bimport\s*\(/.test(html)) fail('dynamic import() found');
const withoutSvgNs = html.replace(/https?:\/\/www\.w3\.org\/2000\/svg/g, '');
if (/https?:\/\//.test(withoutSvgNs)) fail('remote URL found');
if (html.indexOf('const DATA = ') === -1) fail('inlined "const DATA =" not found');

// 2. Extract the inlined DATA object and compare to the JSON assets.
//    The generator emits `const DATA = {...};` on a single line, so capture
//    from the marker to the end of that line and strip the trailing semicolon.
const marker = 'const DATA = ';
const start = html.indexOf(marker) + marker.length;
const lineEnd = html.indexOf('\n', start);
if (start === -1 || lineEnd === -1) {
  fail('could not delimit inlined DATA object');
} else {
  const literal = html.slice(start, lineEnd).replace(/;\s*$/, '');
  let data;
  try {
    data = JSON.parse(literal);
  } catch (e) {
    fail('inlined DATA is not valid JSON: ' + e.message);
  }

  if (data) {
    const expected = {
      'male-front': { file: 'male-front.json', parts: 28 },
      'male-back': { file: 'male-back.json', parts: 16 },
      'female-front': { file: 'female-front.json', parts: 28 },
      'female-back': { file: 'female-back.json', parts: 14 },
    };

    for (const key of Object.keys(expected)) {
      const exp = expected[key];
      if (!data[key]) {
        fail('inlined DATA missing body "' + key + '"');
        continue;
      }
      const onDisk = JSON.parse(readFileSync(join(ASSET_DIR, exp.file), 'utf8'));
      if (data[key].parts.length !== exp.parts) {
        fail(key + ' inlined part count ' + data[key].parts.length + ' != ' + exp.parts);
      }
      // Deep-equal the inlined body against the on-disk asset.
      const a = JSON.stringify(data[key]);
      const b = JSON.stringify(onDisk);
      if (a !== b) fail(key + ' inlined DATA differs from on-disk ' + exp.file);
      else console.log('  ' + key + ' inlined DATA matches ' + exp.file + ' (' + exp.parts + ' parts)');
    }
  }
}

if (failures === 0) {
  console.log('\nPREVIEW CHECKS PASSED (self-contained, data in sync)');
} else {
  console.log('\n' + failures + ' PREVIEW CHECK(S) FAILED');
  process.exitCode = 1;
}
