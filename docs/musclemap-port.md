# MuscleMap port

Port the MuscleMap SwiftUI SDK body artwork and heatmap behavior to React/SVG,
replacing the current flat ellipse map in `app/src/components/MuscleMap.tsx`.

Source: `C:\Users\trist\AppData\Local\Temp\opencode\MuscleMap` (MIT, Copyright
2026 Melih Colpan). Keep the copyright and license in `docs/credits.md` and
`NOTICE`, and show an attribution line in Settings.

## What we port

- Male and female bodies, front and back.
- Base muscles plus sub-groups, with parent/child inheritance.
- Left and right sides.
- Always-visible sub-groups (ankles, adductors, neck).
- Hit testing with sub-group priority.
- Heatmap with stepped interpolation and a legend.
- Selected state.
- aria-labels.
- Optional pinch-to-zoom.

What we do NOT port: style presets, gradient fills, pulse, shadows, undo/redo,
multi-select, long press, drag select, tooltips, localization.

## File locations

Extraction pipeline (already built and verified):

- `scripts/extract-musclemap.mjs` - parses the 4 Swift path files, emits the 4 JSON assets.
- `scripts/verify-musclemap.mjs` - JSON/schema/byte-for-byte checks.
- `scripts/generate-musclemap-preview.mjs` - builds the standalone preview.
- `scripts/verify-musclemap-preview.mjs` - self-contained + data-sync checks.

Generated assets (the only writes under `app/src`):

- `app/src/assets/musclemap/male-front.json` - 28 parts, 111 paths.
- `app/src/assets/musclemap/male-back.json` - 16 parts, 70 paths.
- `app/src/assets/musclemap/female-front.json` - 28 parts, 114 paths.
- `app/src/assets/musclemap/female-back.json` - 14 parts, 66 paths.

QA preview (open by double-click, no build step):

- `docs/design-preview/musclemap-preview.html` - all 4 bodies, one color per
  region, per-body legend.

## Data format

Each JSON file:

```json
{
  "gender": "male",
  "side": "front",
  "viewBox": { "x": 0, "y": 95, "width": 727, "height": 1280 },
  "parts": [
    {
      "slug": "chest",
      "parent": null,
      "alwaysVisible": false,
      "isMuscle": true,
      "order": 0,
      "common": [],
      "left": ["M..."],
      "right": ["M..."]
    }
  ]
}
```

- `slug` - the region identifier.
- `parent` - parent slug for sub-groups, else null.
- `alwaysVisible` - true only for `ankles`, `adductors`, `neck`.
- `isMuscle` - false for `hair` and `head` (cosmetic), true otherwise.
- `order` - 0-based source index, i.e. draw order.
- `common` / `left` / `right` - SVG `d` strings, usable verbatim in
  `<path d>`. `common` is shared by both sides; `left` and `right` are the
  per-side paths.

## Coordinate system

Each body has its own viewBox. The SDK centers the body in the render area by
scaling the viewBox to fit and offsetting. In React, set the SVG `viewBox`
attribute to `x y width height` from the JSON and let the browser scale it.

- maleFront: `0 95 727 1280`
- maleBack: `718 95 727 1280`
- femaleFront: `0 0 650 1450`
- femaleBack: `823 0 650 1450`

## How the model works

- Draw order: render `parts` in `order` sequence. Later parts draw on top.
- Sub-group inheritance: if a sub-group has no highlight of its own, it takes
  the parent's highlight.
- Always-visible sub-groups: `ankles`, `adductors`, `neck` render even when
  sub-groups are hidden; a tap on them resolves to the parent.
- Hit testing: test sub-groups before their parents so the smaller region wins.
- Sides: `left` and `right` path arrays map to the left and right body side.
  `common` paths are shared.

## Mapping table

`plan.json` uses 10 muscle keys (verified from `app/public/plan.json`), not
the 15 in the earlier aspirational table. The map lights up the SDK region
each key maps to, in the view(s) listed.

| plan.json key | SDK region | View | Note |
| --- | --- | --- | --- |
| chest | chest | front | |
| front_delts | frontDeltoid | front | |
| side_delts | deltoids | back | |
| rear_delts | deltoids | back | fallback |
| biceps | biceps | front | |
| brachialis | biceps | front | fallback |
| triceps | triceps | front, back | |
| lats | upperBack | back | |
| mid_back | upperBack | back | fallback |
| upper_back | upperBack | back | |

Everything not in this table stays neutral.

Notes on the collapses:

- `side_delts` and `rear_delts` both light the `deltoids` region on the back.
- `lats`, `mid_back`, and `upper_back` all light the `upperBack` region on
  the back.
- `brachialis` has no SDK region, so it lights `biceps` on the front.

## Gap analysis (resolved)

The SDK enum defines `rearDeltoid`, `upperTrapezius`, and `rhomboids`, but
none of them have geometry in the 4 path files. Decisions (approved):

1. rear delts - fall back to the whole `deltoids` region on the back.
2. upper traps - not a `plan.json` key, so not mapped. (If added later, fall
   back to the whole `trapezius` region on the back.)
3. mid back - fall back to the `upperBack` region on the back.
4. brachialis - no SDK region; fall back to `biceps` on the front.

## Heatmap

Warm heatmap, 6 discrete steps (gray to yellow to orange to red). Red is the
most volume, not an error state.

Dark tokens:

- `--muscle-0` `#2A2A2A`
- `--muscle-1` `#A89A4A`
- `--muscle-2` `#C9A33D`
- `--muscle-3` `#D98A35`
- `--muscle-4` `#D9692F`
- `--muscle-5` `#C9443A`

Light tokens:

- `--muscle-0` `#E9E9E7`
- `--muscle-1` `#E6D58A`
- `--muscle-2` `#E8BF5A`
- `--muscle-3` `#EA9F4A`
- `--muscle-4` `#E27A3E`
- `--muscle-5` `#CF4B3F`

Volume to step:

- 0 sets = 0
- under 10 = 1 to 3
- 10 to under 20 = 4
- 20 or more = 5

Legend: a 6-block horizontal bar, labels 0, 10, 20, with a bracket over the
4 to 5 range marked "target range".

Note: the SDK's `workoutStepped` scale uses 4 colors and 5 steps. We do not
use it. We define our own 6-step scale with the tokens above.

## Counting rule

Unilateral exercises count rounds, not sides.

## Scope note (resolved)

The task referenced `docs/muscle-map.md`, `app/src/lib/muscles.ts`, a time
range control, a bottom sheet, a muscle list, and three placements as things
to keep. None of these exist. Decision (approved): ignore all of them. Build
only what is necessary to get the muscle maps to work.

The only muscle-related code today is `app/src/components/MuscleMap.tsx` and
`muscle-map.css` (the M9 flat SVG on the Exercise page), used in exactly one
place: `app/src/screens/Exercise.tsx` line 151, with a
`primary`/`secondary` string-array API. Phase 2 replaces that component with
the new SVG map, keeping the same `primary`/`secondary` API so the call site
does not change. No time range control, bottom sheet, muscle list, or extra
placements.
