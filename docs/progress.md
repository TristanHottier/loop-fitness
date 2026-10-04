# Progress

Milestone checklist. The orchestrator updates this file at the end of each milestone.
Definition of done for each milestone is taken from `docs/fitness-app-brief.md` (section 10).

## M0: Repo, scaffold, deploy
Done when: an empty installable PWA is live on Cloudflare Pages and opens on the phone.

- [x] Vite + React + TypeScript scaffold in `app/`
- [x] PWA: web manifest, service worker, installable on Android (Chrome)
- [x] App shell: bottom nav (Today, Plan, Progress, Settings) with placeholder screens
- [x] Design tokens: dark default, light available (section 9)
- [x] Cloudflare Pages deploy config
- [x] Deployed to Cloudflare Pages (project `loop-fitness`, production branch `main`)
- [ ] Verified on the phone (user to confirm it opens and is installable)
- [x] Reviewer pass (M0 review: PASS, no violations)

Status: deployed live, awaiting phone verification

## M1: Plan and exercise pages
Done when: the three workouts and every exercise page render from `plan.json`, with YouTube embeds and gallery images.

- [x] `plan.json` generated from `content/` (3 workouts, 21 exercises, band ladders, overrides for supersets)
- [x] Gallery folders `app/public/gallery/<exercise-slug>/` (21) + `media.json` (21 slugs, ready for user content)
- [x] Plan screen: three workouts, each exercise opens its page
- [x] Exercise page: written instructions, YouTube embed (privacy-enhanced), gallery images
- [x] Offline: `plan.json` and `media.json` precached by the service worker
- [x] Reviewer pass (M1 review: all items PASS after the offline precache fix)

Status: complete, awaiting deploy and user content (YouTube links, gallery pictures)

## M2: Session logging and rest timer
Done when: a full workout can be logged offline, and the timer starts per set with the right duration.

Tasks (~15 min each):
1. [x] Dexie db layer: `app/src/db/db.ts` (sessions + set_logs stores, helpers)
2. [x] Session screen logging UI: `app/src/screens/Session.tsx` + `session.css`
3. [x] Today screen + navigation: `app/src/screens/Today.tsx` + `today.css` + `app/src/App.tsx`
4. [x] Rest timer component: `app/src/components/RestTimer.tsx` + `rest-timer.css` + wake lock
5. [x] Timer wiring + superset/unilateral rules (in `Session.tsx`)
6. [x] Reviewer pass + deploy + commit

Status: complete (reviewer pass on all 8 items; two brief deviations fixed: reps prefill + local date; deployed + committed)

## M3: Progress
Done when: weight and arm entries with charts, and a history view.

Tasks (~15 min each):
1. [x] `body_metrics` Dexie store + helpers (extend `app/src/db/db.ts`)
2. [x] Chart component: `app/src/components/Chart.tsx` + `chart.css` (SVG line chart, 7-day average)
3. [x] Progress screen: `app/src/screens/Progress.tsx` + `progress.css` (weight + arm charts, entries table, add/edit)
4. [x] History screen: `app/src/screens/History.tsx` + `history.css` (past sessions, editable)
5. [x] Wire History into navigation (`app/src/App.tsx`)
6. [x] Reviewer pass + deploy + commit

Status: complete (reviewer 9/9 pass after post-review fixes: middle dots, gradient swatch, 360px table scroll, 48px touch targets; deployed + committed)

## M4: Auth and sync
Done when: data written on one device appears on another, and offline edits sync later.

Tasks (~15 min each):
1. [x] Worker scaffold + D1 migration: `api/package.json`, `api/wrangler.jsonc`, `api/tsconfig.json`, `api/src/index.ts`, `api/migrations/0001_init.sql`
2. [x] Deploy Worker + create D1 + set PASSPHRASE secret (wrangler, Cloudflare)
3. [x] Frontend sync layer: `app/src/sync/sync.ts` (outbox queue, authenticate, push, pull) + `app/src/db/db.ts` (sync_queue store + enqueue in mutation helpers)
4. [x] Settings screen: `app/src/screens/Settings.tsx` + `settings.css` (passphrase, sync status, sync now, theme)
5. [x] Wire sync into the app (flush on change, pull on load)
6. [x] Reviewer pass + deploy + commit

Status: complete (D1 created + migration applied, Worker deployed at loop-fitness-api.tristan-ho2tier.workers.dev, PASSPHRASE secret set, sync round-trip verified end-to-end; PWA redeployed with sync URL; committed)

## M5: Suggestions
Done when: next-band suggestions, measurement and deload prompts.

Tasks (~15 min each):
1. [x] Suggestion logic: `app/src/lib/suggestions.ts` (nextBand, suggestForExercise, armMeasurementDue, deloadDue)
2. [x] Show next-band suggestion on the exercise card in `app/src/screens/Session.tsx`
3. [x] Show due prompts (arm measurement, deload) on `app/src/screens/Today.tsx`
4. [x] CSS for suggestion/prompt notes (session.css, today.css)
5. [x] Reviewer pass + deploy + commit

Status: complete (reviewer 6/6 pass; two minor fixes applied post-review: latest-session keyed on session date, stay-message wording; deployed + committed)

## M6: Reminders
Done when: weigh-in reminder and other toggles work through Web Push.

Tasks (~15 min each):
1. [x] VAPID keys + Web Crypto push lib: `@mmmike/web-push` in `api/`, key pair generated, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` Worker secrets set
2. [x] Worker push endpoints + cron: `api/src/index.ts` (`/push/vapid-public-key`, `/push/subscribe`, `/push/unsubscribe`, `runReminders` + `scheduled`), cron `*/15 * * * *` in `api/wrangler.jsonc`
3. [x] Custom service worker: `app/src/sw.ts` (push + notificationclick handlers), `vite.config.ts` switched to `injectManifest`
4. [x] Push client + Settings Reminders section: `app/src/push/push.ts`, `app/src/screens/Settings.tsx` + `settings.css` (weigh-in toggle + time, default off)
5. [x] Reviewer pass + deploy + commit

Status: complete (reviewer 7/7 pass; one post-review fix applied: reminder window midnight-wrap; Worker + PWA deployed, VAPID secrets set, cron trigger live)

## M7: Polish and QA
Done when: reviewer pass on all checklists, CSV export, README with install steps.

Tasks (~15 min each):
1. [x] Red error color: `--color-error` token in `app/src/styles/tokens.css` (dark `#F87171`, light `#C0392B`), used by `.settings-status-error` in `app/src/screens/settings.css`
2. [x] CSV export: `app/src/lib/export.ts` (`exportToCsv`, three labeled sections, escaped fields) + "Export CSV" button in `app/src/screens/Settings.tsx` + `.settings-export` in `settings.css`
3. [x] README install steps: "Install on Android" section in `app/README.md`
4. [x] Reviewer pass + deploy + commit

Status: complete (reviewer 7/7 pass; PWA deployed)

## M8: In-workout exercise navigation
Done when: during a session, tapping an exercise name opens its explanation page, and Back returns to the session with all state (inputs, logged sets, rest timer) preserved.

Tasks (~15 min each):
1. [x] `app/src/App.tsx`: `sessionExercise` state; session stays mounted in a `display:none` wrapper while the exercise overlay is shown; overlay renders `<Exercise>` on top; `selectTab`/`onExit` clear the overlay
2. [x] `app/src/screens/Session.tsx`: `onOpenExercise` prop; exercise title is a tappable button with a chevron affordance
3. [x] `app/src/screens/session.css`: tappable title button styling (48px target, flat, sentence case)
4. [x] Reviewer pass + deploy + commit

Status: complete (reviewer 7/7 pass; PWA deployed)

## M9: Muscle diagram on exercise pages
Done when: every exercise page shows a flat Garmin-Connect-style body diagram highlighting primary and secondary muscles.

Tasks (~15 min each):
1. [x] `app/public/plan.json`: `muscles: { primary, secondary }` on all 21 exercises (controlled 10-key vocabulary)
2. [x] `app/src/data/plan.ts`: `muscles` added to the `Exercise` interface
3. [x] `app/src/components/MuscleMap.tsx` + `muscle-map.css`: flat front + back SVG figures, accent = primary, muted = secondary, legend
4. [x] `app/src/screens/Exercise.tsx`: "Muscles" section after "Targets"
5. [x] Reviewer pass + deploy + commit

Status: complete (reviewer pass with one minor flag, fixed: legend swatch radius 3px to var(--radius-sm); PWA deployed)

## M10: Progress cleanup + chart axis fix
Done when: the Progress page shows only the charts and the add-entry box, and the arm chart y-axis reads correctly (no mod-10 wrap).

Tasks (~15 min each):
1. [x] `app/src/components/Chart.tsx`: "nice numbers" y-axis (1/2/5x10^n step, min floored / max ceiled to step multiples; data plotted against nice bounds; single 29 cm entry reads as 29)
2. [x] `app/src/screens/Progress.tsx`: removed the entries table (Edit/Delete) and dead state/handlers; kept the three charts + add-entry form
3. [x] `app/src/screens/progress.css`: removed unused table styles
4. [x] Reviewer pass + deploy + commit

Status: complete (reviewer 7/7 pass; two non-blocking notes: updateBodyMetric/deleteBodyMetric now dead in db.ts, pre-existing 360px label clip; PWA deployed)

## M11: History "Show sets" opens a session-like editable page
Done when: "Show sets" on a past session opens a page that looks like an in-progress workout, with editable reps/band/note, a Save button (not Finish), and no Check/Done buttons.

Tasks (~15 min each):
1. [x] `app/src/db/db.ts`: `getSession`, `updateSetLog`, `deleteSetLog` helpers (soft-delete + sync outbox)
2. [x] `app/src/screens/SessionDetail.tsx` + `session-detail.css`: session-like page, Save button, upsert/soft-delete save logic, no check/done/timer/suggestions
3. [x] `app/src/screens/History.tsx` + `history.css`: "Show sets" button opens the detail page; `version` prop re-fetches on return; removed inline set expansion
4. [x] `app/src/App.tsx`: `historySession`/`historyVersion` state; History stays mounted under the detail page
5. [x] Reviewer pass + deploy + commit

Status: complete (reviewer 8/8 pass; three non-blocking notes: implicit session.css class reuse, in-place log mutation, .history-card-toggle retained; PWA deployed)

## M12: Nutrition tracking page
Done when: a 5th "Nutrition" tab shows calorie and protein charts, a daily goal-reached indicator, and editable goals (defaults 2800 kcal / 150 g).

Tasks (~15 min each):
1. [x] `api/migrations/0002_nutrition.sql`: `nutrition` table (id, date, calories, protein, updated_at, deleted) + date index
2. [x] `api/src/index.ts`: `nutrition` added to `TABLES` + `TABLE_COLUMNS` (generic push/pull picks it up)
3. [x] `app/src/db/db.ts`: `NutritionEntry` + `nutrition` Dexie store (v4) + create/update/delete/get helpers (sync outbox)
4. [x] `app/src/sync/sync.ts`: `nutrition` in fetch/merge/pull
5. [x] `app/src/components/BottomNav.tsx` + `app/src/App.tsx`: 5th "Nutrition" tab (Utensils icon)
6. [x] `app/src/screens/Nutrition.tsx` + `nutrition.css`: Today goal card (goal reached / N to go), calorie + protein charts, add-entry form (upsert on date), editable goals (2800/150 defaults, persisted via settings)
7. [x] Reviewer pass + D1 migration applied + Worker + PWA deploy + commit

Status: complete (reviewer 8/8 pass; two non-blocking notes: empty input stores 0, multi-row date picks newest; D1 migration 0002 applied, Worker + PWA deployed)

## M13: Logo into PWA icons + .gitignore housekeeping
Done when: the PWA icon slots use the real logo (not the blue-square placeholders) and setup.sh is ignored.

Tasks (~15 min each):
1. [x] `app/public/icons/icon-192.png` + `icon-512.png`: replaced the blue-square placeholders with the real logo (from `loop-fitness-logo-192.png` / `loop-fitness-logo-512.png` at the repo root)
2. [x] `.gitignore`: added `setup.sh` and untracked it
3. [x] Build + PWA deploy + commit

Status: complete (PWA deployed; manifest already pointed at /icons/icon-192.png and /icons/icon-512.png)

## M14: Reset session history
Done when: a "Reset session history" button in Settings (with a confirm step) soft-deletes all sessions and set logs, enqueues them to the sync outbox, and propagates to the server when connected.

Tasks (~15 min each):
1. [x] `app/src/db/db.ts`: `resetSessionHistory()` helper (soft-delete sessions + set_logs, enqueue each; leaves body_metrics/nutrition/settings untouched)
2. [x] `app/src/screens/Settings.tsx` + `settings.css`: "Data" section with "Reset session history" button, confirm row (calm note + Confirm reset / Cancel), success note, in-flight disable
3. [x] Reviewer pass + PWA deploy + commit

Status: complete (reviewer 7/7 pass; two non-blocking notes: sync-error status shows in Sync section on push failure, success note persists until next tap; PWA deployed, user to tap the reset on the phone)

## M15: Remove superset system
Done when: the superset system is fully removed from the code, data, content, and spec; the rest timer starts after every exercise (unilateral rule kept); the two superset entries in Shoulders and arms become standalone exercises.

Tasks (~15 min each):
1. [x] `app/src/data/plan.ts`: removed `supersetGroup` from the `Exercise` interface
2. [x] `app/src/screens/Session.tsx`: removed `getSupersetRole` + the "no timer after first of a pair" guard; timer now starts after every exercise (unilateral "after second side" rule kept); removed the "Superset X." note
3. [x] `app/src/screens/Plan.tsx`: removed the "superset X" tag
4. [x] `app/public/plan.json`: removed the `supersetGroup` key from all 21 exercises; shoulders-arms overrides now keep only sets + restSeconds
5. [x] `content/workout-3-shoulders-arms.md`: Superset A/B converted to four standalone exercises (wide-grip-barbell, push-down-tricep, side-pull-biceps, triceps-extension), renumbered; superset wording removed
6. [x] Spec/docs: `docs/fitness-app-brief.md` (workout table, schema notes, rest-timer line, skill table), `.opencode/skills/rest-timer/SKILL.md`, `.opencode/skills/plan-data-and-progression/SKILL.md`, `.opencode/agents/plan-data.md`
7. [x] Reviewer pass + PWA deploy + commit

Status: complete (reviewer 7/7 pass; four new standalone headers given the Sets x Reps suffix to match the file's style; PWA deployed)

## M16: Design v2, Direction A restyle (Phase 2)
Done when: the whole app is restyled to Direction A (Notion with a richer finish), the banned-character rules hold, and the reviewer passes the design checklist at 360 to 412 px.

Tasks:
1. [x] `docs/fitness-app-brief.md` section 9 + `.opencode/skills/notion-style-ui/SKILL.md`: rewritten for Direction A (banned list kept)
2. [x] `app/src/styles/tokens.css`: Direction A tokens (panel/surface alias, sheet, hover, three workout hues, 10 muscle colors, Figtree/Inter, shadow-soft, a new --color-positive); `app/src/main.tsx` + `app/package.json`: self-hosted @fontsource Figtree (500,700) + Inter (400,500,600,700)
3. [x] `app/src/screens/Session.tsx` + `session.css`: infinity-line cover band, thin progress line, exercise toggles, active-exercise left border + hue tint, drawing checkbox, "new best" pill, restyled Finish, session-complete view (infinity line draws on)
4. [x] `app/src/components/RestTimer.tsx` + `rest-timer.css`: floating bottom bar with a depleting ring in the workout hue
5. [x] `app/src/components/BandPicker.tsx` + `band-picker.css`: new bottom-sheet band picker (Tube/Loop ladder, last-used underline), wired into the Session band field
6. [x] `app/src/screens/Today.tsx` + `today.css`: week strip (Mon to Sun, 3 training days marked, done days as filled rings), thin session progress line, next-workout card, weight entry property row
7. [x] `app/src/screens/Progress.tsx` + `progress.css` + `app/src/components/Chart.tsx` + `chart.css`: one-hue charts with a soft single-hue area fade, a direct label on the latest point, chart cards with a header row (latest value + delta tag), flat entries form
8. [x] `app/src/screens/Plan.tsx` + `plan.css`: per-workout cover band, property rows (Day, Exercises, Total sets, Rest), flat exercise rows
9. [x] `app/src/screens/Exercise.tsx` + `exercise.css` + `app/src/components/MuscleMap.tsx` + `muscle-map.css`: exercise cover band, property rows for the spec, muscle map now uses the per-group --muscle-* colors (primary full opacity, secondary 45%)
10. [x] `app/src/screens/Settings.tsx` + `settings.css`: flat property rows, Figtree section titles, panel cards, destructive reset in the error color
11. [x] Banned-character grep (em/en dashes, middle dots, uppercase, monospace, exclamation marks) clean; full build passes
12. [x] Reviewer pass + PWA deploy + commit

Status: complete (reviewer clean pass after post-review fixes: today-ring box-shadow to outline, timer bar + band picker radius to var(--radius), weight row restructured to wrap at 360px; PWA deployed)

## M17: Per-session delete in History
Done when: each session card in History has a Delete option that, with a confirm step, soft-deletes that session and its set logs and propagates the delete to the server via the sync outbox.

Tasks:
1. [x] `app/src/db/db.ts`: `deleteSession(id)` helper (soft-delete one session + its set logs, enqueue each to the sync outbox; mirrors `resetSessionHistory`)
2. [x] `app/src/screens/History.tsx` + `history.css`: per-card "Delete" button in a `.history-card-actions` row, a `.history-delete-confirm` block (calm note + "Confirm delete" / "Cancel", per-card busy state), destructive styling in `var(--color-error)`
3. [x] Reviewer pass + PWA deploy + commit

Status: complete (reviewer 6/6 pass; one non-blocking note fixed: per-card busy state so an in-flight delete on one card does not close another card's confirm row; PWA deployed, commit 4d9ab43)

## M18: MuscleMap port (SVG body artwork)
Done when: the flat ellipse muscle map is replaced with the MuscleMap SDK full-body SVG artwork, the 10-key mapping lights the right regions with sub-group inheritance, and the MIT attribution is in place.

Tasks:
1. [x] `scripts/extract-musclemap.mjs` + `scripts/verify-musclemap.mjs`: parse the 4 Swift path files into JSON assets (28/16/28/14 parts, 361 path strings byte-for-byte)
2. [x] `app/src/assets/musclemap/{male-front,male-back,female-front,female-back}.json`: generated body artwork assets
3. [x] `docs/design-preview/musclemap-preview.html`: standalone QA preview (all 4 bodies, one color per region, per-body legend)
4. [x] `docs/musclemap-port.md`: data format, coordinate system, model rules, 10-key mapping table, gap analysis, heatmap tokens, counting rule, attribution
5. [x] `app/src/components/MuscleMap.tsx` + `muscle-map.css`: rewritten to render the full-body SVG artwork from the JSON assets, stacked front over back, 10-key mapping with sub-group inheritance, cosmetic head/hair neutral, `vector-effect: non-scaling-stroke`, same `primary`/`secondary` API
6. [x] `docs/credits.md` + `NOTICE` + `app/src/screens/Settings.tsx` Credits section: MIT attribution (MuscleMap, Copyright (c) 2026 Melih Colpan)

Decisions (approved): rear delts fall back to the back `deltoids` region, mid back falls back to the back `upperBack` region, brachialis falls back to the front `biceps` region. Minimal scope: no volume heatmap, time range control, bottom sheet, muscle list, extra placements, or gender selection.

Status: complete (reviewer clean pass after the attribution fix; PWA deployed, commit 16a39ac)
