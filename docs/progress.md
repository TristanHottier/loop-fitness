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
1. [ ] Worker scaffold + D1 migration: `api/package.json`, `api/wrangler.jsonc`, `api/tsconfig.json`, `api/src/index.ts`, `api/migrations/0001_init.sql`
2. [ ] Deploy Worker + create D1 + set PASSPHRASE secret (wrangler, Cloudflare)
3. [ ] Frontend sync layer: `app/src/sync/sync.ts` (outbox queue, authenticate, push, pull) + `app/src/db/db.ts` (sync_queue store + enqueue in mutation helpers)
4. [ ] Settings screen: `app/src/screens/Settings.tsx` + `settings.css` (passphrase, sync status, sync now, theme)
5. [ ] Wire sync into the app (flush on change, pull on load)
6. [ ] Reviewer pass + deploy + commit

Status: in progress
