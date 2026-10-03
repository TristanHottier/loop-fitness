# Fitness app: brief for Gemini

## 0. Your job

You are taking over a planning handoff. Do **not** build the app. Produce, from this brief only:

1. One **agent prompt** per agent listed in section 7.
2. One **SKILL.md** per skill listed in section 8.
3. An `opencode.json` that sets the model for every agent (provider and model id left as placeholders, the model is Qwen 3.8 through an API, unlimited usage).
4. `PROMPT.md`: the **initial prompt** the user sends to the agent collection to start work (section 10 says what it must do).

Before writing files, check the current OpenCode documentation for the exact formats and locations of agent files, skill files and `opencode.json`, and follow them. Verify Cloudflare free-tier limits and Web Push details the same way. Output each file in its own fenced block with its path above it, then a short list of assumptions the user should confirm.

**Qwen writing rules.** Every prompt must be short and imperative, name exact file paths, and give numbered steps. Do not paste long documents into prompts, point to files instead (`docs/brief.md`, `content/`). Each agent prompt: role, inputs, workflow, rules, definition of done, handoff format. Target 350 words per agent, 300 per skill.

---

## 1. Product

A personal, single-user app to track a 3-day band training plan. Used on a Samsung S23 Ultra (Android, Chrome), installed as a PWA from the browser. Free to run, forever.

Core features:
- Follow the plan: Monday, Wednesday, Friday evenings (Pull, Push, Shoulders and arms).
- Log each set: reps and band used, optional note per set or session.
- Rest timer that starts when a set is marked done and uses that exercise's rest time.
- Per-exercise page: written instructions, embedded YouTube videos, and pictures from a gallery folder.
- Progress: body weight (daily) and arm circumference (about every 4 weeks), with charts. Other metrics (shoulders, chest, waist) are optional and hidden by default.
- Progression suggestions (never automatic changes).
- Reminders, notification times to be set later in the app (morning weigh-in is the main one).
- Data synced across devices, works offline.

Out of scope: progress photos, multi-user, social features, native APK, plan editing.

---

## 2. Decisions

| Topic | Decision |
|---|---|
| Platform | PWA (Vite, React, TypeScript), installed from Chrome |
| Hosting | Cloudflare Pages for the static app |
| Backend | Cloudflare Worker (or Pages Functions) with D1 for sync. Chosen so everything stays on one free provider. Verify free-tier limits |
| Auth | Single user. One passphrase stored as a Worker secret, exchanged for a long-lived token kept on the device |
| Data | Local first in IndexedDB (Dexie), sync queue to the API, last write wins by `updated_at`, soft deletes |
| Units | kg and cm for the body, lb for bands |
| Language | English |
| Theme | Dark by default, light available |
| Plan | Fixed, shipped as `plan.json`, seeded from the workout files in `content/` |
| Media | YouTube links per exercise (privacy-enhanced embeds) and images from `app/public/gallery/<exercise-slug>/` picked up automatically at build time |
| Reminders | Web Push through a Worker Cron Trigger, built in a late milestone. Times configurable in Settings, all off by default |
| Agents | Qwen 3.8 via API in OpenCode |

---

## 3. Repository layout

```
fitness-app/
  opencode.json
  .opencode/            agents and skills (formats per OpenCode docs)
  docs/
    brief.md            this file
    progress.md         milestone checklist kept by the orchestrator
  content/              workout-1-pull.md, workout-2-push.md,
                        workout-3-shoulders-arms.md, 00-program-guide.md
  app/                  Vite React PWA
    public/gallery/<exercise-slug>/
    src/
  api/                  Worker, D1 migrations
```

The three workout files and the program guide in `content/` are the source of truth for exercise descriptions, form cues and progression rules. The user copies them in.

---

## 4. Plan data

Rest times are seconds. "T" is a tube band, "L" a loop band. Start band is only a default for the picker.

**Band ladders (lb, ratings at full stretch)**
- Tube: `30`, `40`, `50`, `30+40`, `40+50`, `30+40+50`
- Loop: `5-30`, `15-50`, `25-75`, `35-95`, `50-145`

**Workout 1: Pull**

| Exercise | Equip | Sets x reps | Rest | Start |
|---|---|---|---|---|
| Pull down | T | 4 x 10-15 | 90 | T40 |
| Seated row | T | 4 x 10-15 | 90 | T40 |
| Bend over rows | L | 4 x 10-15 | 90 | L35-95 |
| Push down (straight-arm) | T | 3 x 15 | 60 | T30 |
| Reverse fly | T | 3 x 15-20 | 60 | T30 |
| Close grip barbell | T + Pilates bar | 4 x 10-12 | 75 | T30 |
| Curl biceps (neutral grip) | T | 3 x 12-15 | 60 | T30 |

**Workout 2: Push**

| Exercise | Equip | Sets x reps | Rest | Start |
|---|---|---|---|---|
| Lying chest press | L | 4 x 8-15 | 90 | L25-75 |
| Hex press | T | 4 x 12-15 | 75 | T40 |
| Standing press | T | 4 x 10-12 | 90 | T40 |
| Lateral raises | T | 4 x 15-20 | 60 | T30 |
| Push-down tricep | T | 4 x 12-15 | 60 | T30 |
| Triceps extension | L | 3 x 12-15 | 60 | L15-50 |

**Workout 3: Shoulders and arms**

| Exercise | Equip | Sets x reps | Rest | Start |
|---|---|---|---|---|
| Lateral raise | L | 4 x 15-20 | 60 | L5-30 |
| Bend over fly | T | 3 x 15-20 | 60 | T30 |
| Upright row | L | 3 x 12-15 | 60 | L25-75 |
| Pull down (underhand) | T | 3 x 12-15 | 75 | T40 |
| Cable crossover | T | 3 x 12-15 | 60 | T40 |
| Wide grip barbell | T + Pilates bar | 3 x 10-12 | 75 | T30 |
| Push-down tricep | T | 3 x 12-15 | 75 | T30 |
| Side pull biceps (each side) | T | 3 x 12-15 | 75 | T30 |
| Triceps extension | L | 3 x 12-15 | 75 | L15-50 |
| Bicep curls (optional finisher) | L | 2 x 20 | 45 | L15-50 |

**Schema notes.** An exercise has `slug`, `name`, `equipment`, `repMin`, `repMax`, `sets`, `restSeconds`, `startBand`, `unilateral`, `optional`. Side pull biceps is `unilateral`: one logged set per side.

**Progression suggestion rule.** After a session, for each exercise: if every set hit `repMax` with the same band, suggest the next band on the ladder (or single-arm if already at the top); if any set is under `repMin`, suggest staying on the band. Show it as a note on the exercise card next session. Also show: arm measurement due every 4 weeks, deload week every 6 to 8 weeks (half the sets, same bands).

---

## 5. Data model (D1 and IndexedDB, same shape)

- `sessions`: id, workout_id, date, started_at, ended_at, note
- `set_logs`: id, session_id, exercise_slug, set_index, side (null, L, R), reps, band, note
- `body_metrics`: id, date, type (`weight_kg`, `arm_left_cm`, `arm_right_cm`, `shoulders_cm`, `chest_cm`, `waist_cm`), value
- `settings`: key, value
- `push_subscriptions`: id, endpoint, keys

All synced tables also have `updated_at` and `deleted`. IDs are client-generated UUIDs.

---

## 6. Screens and behaviour

Bottom navigation, four tabs: **Today**, **Plan**, **Progress**, **Settings**.

- **Today**: the next workout, a quick weight entry, any due prompt (measure arms, deload).
- **Workout session**: exercise list. Each set is a row with reps and band prefilled from the last time. Tapping the check on a row logs it and starts the rest timer for that exercise. Optional note per set.
- **Rest timer**: sticky bar at the bottom with countdown, minus 15 s, plus 15 s and skip. Ends with vibration and a short chime. Keep the screen awake during a session (Wake Lock). The timer stores an end timestamp and recomputes on `visibilitychange`, so it stays correct if the page is throttled. Unilateral: timer starts after the second side. Known limit: a web app cannot ring while the screen is locked, say this in the skill.
- **Plan**: the three workouts, each exercise opens its page (instructions from `content/`, YouTube embeds, gallery images).
- **Progress**: weight chart with a 7-day average, arm circumference chart (left and right), simple table of entries, add and edit entries.
- **History**: past sessions, editable.
- **Settings**: reminder toggles and times (default off), theme, sync status, export to CSV.

---

## 7. Agents (5)

| Agent | Purpose |
|---|---|
| orchestrator | Reads the brief, keeps `docs/progress.md`, splits each milestone into small tasks, delegates, checks the definition of done, reports to the user at each milestone end. Writes no feature code. |
| frontend | Builds the React PWA: screens, design system, session logging, rest timer, charts, exercise pages. |
| backend | Builds the Worker API, D1 migrations, auth, sync endpoints, and the push cron. |
| plan-data | Converts the `content/` workout files into `plan.json` and exercise pages, sets up the gallery folders and `media.json`, validates everything against the schema. |
| reviewer | Reviews each milestone: runs build, lint and tests, applies the design checklist, tests at 360 to 412 px width, offline and sync behaviour. Returns a pass or fail list. |

---

## 8. Skills (6)

| Skill | Purpose |
|---|---|
| notion-style-ui | Design tokens, layout rules and the banned patterns from section 9, plus a review checklist. |
| plan-data-and-progression | `plan.json` schema, band ladders, the progression suggestion rule and the due-prompt rules. |
| pwa-offline-sync | Service worker and manifest (vite-plugin-pwa), Dexie stores, sync queue, last-write-wins rule, install on Android. |
| rest-timer | Timestamp-based timer, Wake Lock, vibration and chime, unilateral logic, the screen-lock limit. |
| cloudflare-stack | Pages deploy, Worker, D1 migrations, secrets, Cron Triggers, local dev with wrangler, free-tier limits to respect. |
| web-push-reminders | VAPID keys, subscription flow on Android, Worker cron that sends the weigh-in and other reminders at user-set times. |

---

## 9. Design rules (apply to every screen and every UI string)

Reference: the Notion website and app. Calm, flat, document-like.

**Do**
- System sans font stack: `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`. Tabular numerals for numbers and the timer.
- Sentence case everywhere. Page titles about 28 px, bold. Body 16 px.
- Flat surfaces, 1 px borders, radius 4 to 6 px, almost no shadows, generous whitespace, left-aligned content.
- Touch targets at least 48 px.
- Simple outline icons (Lucide) or none.
- Dark tokens: background `#191919`, surface `#202020`, hover `#2A2A2A`, border `#2F2F2F`, text `#EBEBEB`, secondary text `#9B9B9B`, accent `#529CCA`.
- Light tokens: background `#FFFFFF`, surface `#F7F6F3`, hover `#EFEEEC`, border `#E9E9E7`, text `#37352F`, secondary text `#787774`, accent `#2383E2`.
- Accent used sparingly: primary buttons, the active tab, chart lines.

**Never**
- Em dashes or en dashes in UI text, and no center dots (middle dots) as separators, use commas or separate lines.
- Monospace fonts anywhere in the UI.
- Large all-caps titles or any `text-transform: uppercase`.
- Gradients, glows, sparkle icons, purple or neon colours, glassmorphism, big rounded cards with heavy shadows, emoji overload, decorative illustrations.
- Marketing-style copy or exclamation marks.

---

## 10. Milestones and the initial prompt

| # | Milestone | Done when |
|---|---|---|
| M0 | Repo, scaffold, deploy | Empty installable PWA is live on Cloudflare Pages and opens on the phone |
| M1 | Plan and exercise pages | The three workouts and every exercise page render from `plan.json`, with YouTube embeds and gallery images |
| M2 | Session logging and rest timer | A full workout can be logged offline, timer starts per set with the right duration |
| M3 | Progress | Weight and arm entries with charts, history view |
| M4 | Auth and sync | Data written on one device appears on another, offline edits sync later |
| M5 | Suggestions | Next-band suggestions, measurement and deload prompts |
| M6 | Reminders | Weigh-in reminder and other toggles work through Web Push |
| M7 | Polish and QA | Reviewer pass on all checklists, CSV export, README with install steps |

`PROMPT.md` (the initial prompt to the orchestrator) must:
- Tell it to read `docs/brief.md` and `docs/progress.md` first.
- Start at M0 and go milestone by milestone, using the other agents and skills.
- Stop at the end of every milestone, summarise what was done, what the reviewer found, and wait for the user's go-ahead.
- Keep tasks small (one concern, a few files each) and always pass file paths, never pasted content.
- Ask the user only for things only they can provide: Cloudflare login and secrets, the passphrase, YouTube links, gallery pictures, notification times.
- Remind every agent of the design rules in section 9.
