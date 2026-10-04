#!/usr/bin/env node
// scripts/generate-musclemap-preview.mjs
//
// Builds the standalone, dependency-free QA preview
//   docs/design-preview/musclemap-preview.html
// by inlining the four generated MuscleMap JSON assets as a single
// `const DATA = {...}` object and rendering four SVGs side-by-side.
//
// - No external dependencies (Node built-ins only).
// - Re-runnable: overwrites the HTML on every run.
// - The inlined DATA is produced by JSON.stringify of the on-disk JSON files,
//   so it is byte-for-byte the same path data the app will consume.
//
// Usage:  node scripts/generate-musclemap-preview.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const OUT_DIR = join(repoRoot, 'docs', 'design-preview');
const OUT_FILE = join(OUT_DIR, 'musclemap-preview.html');
const ASSET_DIR = join(repoRoot, 'app', 'src', 'assets', 'musclemap');

const BODIES = [
  { key: 'male-front', file: 'male-front.json', title: 'Male \u2013 Front' },
  { key: 'male-back', file: 'male-back.json', title: 'Male \u2013 Back' },
  { key: 'female-front', file: 'female-front.json', title: 'Female \u2013 Front' },
  { key: 'female-back', file: 'female-back.json', title: 'Female \u2013 Back' },
];

// ---------------------------------------------------------------------------
// Load the four JSON assets and assemble the inlined DATA object.
// ---------------------------------------------------------------------------
const data = {};
for (const b of BODIES) {
  data[b.key] = JSON.parse(readFileSync(join(ASSET_DIR, b.file), 'utf8'));
}

// ---------------------------------------------------------------------------
// HTML template. The client-side script intentionally avoids template
// literals and backticks so it can be embedded verbatim in this generator.
// The `__DATA_JSON__` placeholder is replaced with the serialized DATA.
// ---------------------------------------------------------------------------
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MuscleMap Preview</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #0f1115;
    color: #e6e8ee;
    padding: 24px;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #9aa3b2; font-size: 13px; margin: 0 0 20px; }
  #grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
  }
  .card {
    background: #171a21;
    border: 1px solid #262b36;
    border-radius: 10px;
    padding: 14px;
    display: flex;
    flex-direction: column;
  }
  .card h2 { font-size: 14px; margin: 0 0 10px; color: #cfd6e4; }
  .stage {
    background: #0b0d11;
    border-radius: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 8px;
  }
  .stage svg { width: 100%; max-height: 460px; height: auto; }
  .legend {
    margin-top: 12px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 10px;
    font-size: 11px;
  }
  .legend .item { display: flex; align-items: center; gap: 6px; }
  .legend .swatch {
    width: 11px; height: 11px; border-radius: 3px; flex: 0 0 auto;
    border: 1px solid rgba(255,255,255,0.25);
  }
  .legend .name { color: #b9c1d0; }
  .legend .parent { color: #6b7280; font-size: 10px; }
</style>
</head>
<body>
<h1>MuscleMap Body Part Preview</h1>
<p class="sub">Standalone QA preview. Four bodies rendered side-by-side from inlined JSON. No external dependencies.</p>
<div id="grid"></div>

<script>
const DATA = __DATA_JSON__;

(function () {
  var bodies = ['male-front', 'male-back', 'female-front', 'female-back'];
  var titles = {
    'male-front': 'Male \\u2013 Front',
    'male-back': 'Male \\u2013 Back',
    'female-front': 'Female \\u2013 Front',
    'female-back': 'Female \\u2013 Back'
  };

  // Deterministic slug-keyed palette (golden-angle hue distribution).
  var allSlugs = [];
  bodies.forEach(function (b) {
    DATA[b].parts.forEach(function (p) {
      if (allSlugs.indexOf(p.slug) === -1) allSlugs.push(p.slug);
    });
  });
  var colorOf = {};
  allSlugs.forEach(function (slug, i) {
    if (slug === 'hair' || slug === 'head') {
      colorOf[slug] = '#9aa0a6'; // neutral gray for cosmetic parts
    } else {
      colorOf[slug] = 'hsl(' + Math.round((i * 137.508) % 360) + ', 62%, 52%)';
    }
  });

  var grid = document.getElementById('grid');

  bodies.forEach(function (b) {
    var doc = DATA[b];
    var vb = doc.viewBox;

    var card = document.createElement('div');
    card.className = 'card';

    var h2 = document.createElement('h2');
    h2.textContent = titles[b];
    card.appendChild(h2);

    var stage = document.createElement('div');
    stage.className = 'stage';

    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.width + ' ' + vb.height);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    doc.parts.forEach(function (p) {
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('fill', colorOf[p.slug]);
      g.setAttribute('stroke', 'rgba(0,0,0,0.35)');
      g.setAttribute('stroke-width', '0.75');
      g.setAttribute('stroke-linejoin', 'round');
      g.setAttribute('opacity', '0.92');
      var paths = (p.common || []).concat(p.left || [], p.right || []);
      paths.forEach(function (d) {
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        g.appendChild(path);
      });
      svg.appendChild(g);
    });

    stage.appendChild(svg);
    card.appendChild(stage);

    var legend = document.createElement('div');
    legend.className = 'legend';
    doc.parts.forEach(function (p) {
      var item = document.createElement('div');
      item.className = 'item';
      var sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = colorOf[p.slug];
      var name = document.createElement('span');
      name.className = 'name';
      name.textContent = p.slug;
      if (p.parent) {
        var par = document.createElement('span');
        par.className = 'parent';
        par.textContent = '\\u2190 ' + p.parent;
        item.appendChild(sw);
        item.appendChild(name);
        item.appendChild(par);
      } else {
        item.appendChild(sw);
        item.appendChild(name);
      }
      legend.appendChild(item);
    });
    card.appendChild(legend);

    grid.appendChild(card);
  });
})();
</script>
</body>
</html>
`;

const finalHtml = html.replace('__DATA_JSON__', JSON.stringify(data));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, finalHtml, 'utf8');

const totalPaths = BODIES.reduce((n, b) => {
  const d = data[b.key];
  return n + d.parts.reduce((m, p) => m + p.common.length + p.left.length + p.right.length, 0);
}, 0);

console.log('MuscleMap preview generated');
console.log('  output: ' + OUT_FILE);
console.log('  inlined bodies: ' + BODIES.map((b) => b.key + '=' + data[b.key].parts.length + ' parts').join(', '));
console.log('  total path strings inlined: ' + totalPaths);
