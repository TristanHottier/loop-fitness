#!/bin/bash

echo "Creating directories..."
mkdir -p .opencode/agents \
         .opencode/skills/notion-style-ui \
         .opencode/skills/plan-data-and-progression \
         .opencode/skills/pwa-offline-sync \
         .opencode/skills/rest-timer \
         .opencode/skills/cloudflare-stack \
         .opencode/skills/web-push-reminders

echo "Writing PROMPT.md..."
cat << 'EOF' > PROMPT.md
# Initial Prompt

You are the orchestrator. Please begin by reading `docs/brief.md` to understand the product scope and `docs/progress.md` to establish our starting point.

We are building a single-user fitness PWA. Proceed milestone by milestone, starting at M0 and stopping at the end of every milestone. 

For each milestone:
1. Break the milestone into small, single-concern tasks.
2. Delegate the tasks to the relevant agents (`frontend`, `backend`, or `plan-data`) using their exact file paths.
3. Remind every agent to strictly follow the design rules in section 9 of the brief.
4. Have the `reviewer` agent check the work against the checklist and definition of done.
5. Stop execution at the end of the milestone. Summarise what was accomplished, report what the reviewer found, and wait for my go-ahead.

Do not ask me for anything unless it is a secret, a credential, or user-provided content (like Cloudflare login details, the app passphrase, YouTube links, gallery pictures, or notification times).

Let's begin with M0.
EOF

echo "Writing opencode.json..."
cat << 'EOF' > opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "unsloth-studio/unsloth/Qwen3.6-35B-A3B-MTP-GGUF",
  "provider": {
    "unsloth-studio": {
      "name": "Unsloth Studio",
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "https://ai.helmwire.com/v1",
        "apiKey": "{env:UNSLOTH_API_KEY}"
      },
      "models": {
        "qwen3.8-27b": {
          "name": "Qwen3.8 27B NVFP4 — vLLM",
          "reasoning": true,
          "tool_call": true,
          "temperature": true,
          "limit": {
            "context": 131072,
            "output": 16000
          },
          "options": {
            "temperature": 0.2,
            "topP": 0.9,
            "provider_id": "edf65c37f80c43a1",
            "provider_type": "vllm",
            "external_model": "qwen3.8-27b",
            "provider_base_url": "http://127.0.0.1:8000/v1"
          }
        },
        "unsloth/Qwen3.6-35B-A3B-MTP-GGUF": {
          "name": "Qwen3.6 35B A3B MTP",
          "reasoning": true,
          "tool_call": true,
          "temperature": true,
          "limit": {
            "context": 250000,
            "output": 16000
          },
          "options": {
            "temperature": 0.2,
            "topP": 0.9
          }
        },
        "unsloth/Muse-Glimmer-30B-GGUF": {
          "name": "Muse Glimmer 30B",
          "reasoning": true,
          "tool_call": true,
          "temperature": true,
          "limit": {
            "context": 131072,
            "output": 16000
          },
          "options": {
            "temperature": 0.2,
            "topP": 0.9
          }
        },
        "unsloth/Qwen3.8-27B-GGUF": {
          "name": "Qwen3.8 27B",
          "reasoning": true,
          "tool_call": true,
          "temperature": true,
          "limit": {
            "context": 161792,
            "output": 16000
          },
          "options": {
            "temperature": 0.2,
            "topP": 0.9
          }
        }
      }
    }
  },
  "default_agent": "orchestrator",
  "subagent_depth": 1,
  "permission": {
    "edit": "allow",
    "bash": "allow",
    "skill": {
      "*": "deny",
      "notion-style-ui": "allow",
      "plan-data-and-progression": "allow",
      "pwa-offline-sync": "allow",
      "rest-timer": "allow",
      "cloudflare-stack": "allow",
      "web-push-reminders": "allow"
    }
  },
  "agent": {
    "orchestrator": {
      "description": "Reads the brief, keeps docs/progress.md, splits each milestone into small tasks, delegates, checks the definition of done, reports to the user at each milestone end. Writes no feature code.",
      "mode": "primary",
      "permission": {
        "edit": "allow",
        "bash": "allow",
        "skill": { "*": "deny" },
        "task": { "*": "deny", "frontend": "allow", "backend": "allow", "plan-data": "allow", "reviewer": "allow" }
      }
    },
    "frontend": {
      "description": "Builds the React PWA: screens, design system, session logging, rest timer, charts, exercise pages.",
      "mode": "subagent",
      "permission": {
        "edit": "allow",
        "bash": "allow",
        "skill": { "*": "deny", "notion-style-ui": "allow", "rest-timer": "allow", "pwa-offline-sync": "allow" }
      }
    },
    "backend": {
      "description": "Builds the Worker API, D1 migrations, auth, sync endpoints, and the push cron.",
      "mode": "subagent",
      "permission": {
        "edit": "allow",
        "bash": "allow",
        "skill": { "*": "deny", "cloudflare-stack": "allow", "web-push-reminders": "allow" }
      }
    },
    "plan-data": {
      "description": "Converts the content/ workout files into plan.json and exercise pages, sets up the gallery folders and media.json, validates everything against the schema.",
      "mode": "subagent",
      "permission": {
        "edit": "allow",
        "bash": "allow",
        "skill": { "*": "deny", "plan-data-and-progression": "allow" }
      }
    },
    "reviewer": {
      "description": "Reviews each milestone: runs build, lint and tests, applies the design checklist, tests at 360 to 412 px width, offline and sync behaviour. Returns a pass or fail list.",
      "mode": "subagent",
      "permission": {
        "edit": "deny",
        "bash": "allow",
        "skill": { "*": "deny", "notion-style-ui": "allow" }
      }
    },
    "build": { "disable": true },
    "plan": { "disable": true },
    "compaction": { "description": "Internal agent used during context compaction.", "mode": "subagent", "hidden": true },
    "explore": { "description": "Rapid discovery sub-agent.", "mode": "subagent" },
    "general": { "description": "General-purpose sub-agent for research and multi-step tasks.", "mode": "subagent" },
    "scout": { "description": "Lightweight sub-agent for targeted scouting and exploration.", "mode": "subagent" },
    "summary": { "description": "Internal agent used to summarize a session.", "mode": "subagent", "hidden": true },
    "title": { "description": "Internal agent used to generate session titles.", "mode": "subagent", "hidden": true }
  },
  "compaction": { "auto": true, "prune": true, "tail_turns": 6, "preserve_recent_tokens": 24000, "reserved": 16000 },
  "watcher": { "ignore": [ "node_modules/**", ".next/**", "dist/**", "build/**", ".git/**", "*.log", "*.sqlite", "*.db", ".wrangler/**" ] },
  "lsp": true
}
EOF

echo "Writing Agents..."
cat << 'EOF' > .opencode/agents/orchestrator.md
# Role
You are the orchestrator. You manage the project, plan milestones, track progress, and delegate tasks to specialised agents. You write no feature code yourself.

# Inputs
- `docs/brief.md`
- `docs/progress.md`

# Workflow
1. Read `docs/brief.md` to understand the product scope and architecture.
2. Read `docs/progress.md` to determine the current milestone state.
3. Split the active milestone into small, single-concern tasks (e.g., 2-3 files per task).
4. Delegate tasks to the appropriate sub-agent (`frontend`, `backend`, or `plan-data`), providing exact file paths.
5. Remind the sub-agents of the design rules defined in the brief (section 9).
6. When tasks are complete, delegate QA and validation to the `reviewer` agent.
7. Wait for the reviewer's pass/fail list. If failed, re-delegate fixes.
8. If passed, update `docs/progress.md`, stop execution, and prompt the user for go-ahead before starting the next milestone.

# Rules
- Use short, imperative commands.
- Pass exact file paths to sub-agents (e.g., `app/src/App.tsx`); **never** paste long file contents in your prompts.
- Ask the user directly for things only they can provide (Cloudflare login, secrets, the passphrase, YouTube links, notification times).
- Do not write implementation code.

# Definition of Done
The current milestone's definition of done (from `docs/brief.md`) is fully met, the `reviewer` agent has returned a clean pass, and `docs/progress.md` is updated.

# Handoff Format
Stop and output a summary of the completed work, the reviewer's findings, and any requested credentials/inputs. Wait for user confirmation to proceed.
EOF

cat << 'EOF' > .opencode/agents/frontend.md
# Role
You build the React PWA, focusing on screens, the design system, session logging, the rest timer, charts, and exercise pages.

# Inputs
- Targeted source files (e.g., `app/src/components/*`)
- Relevant skills loaded as needed (`notion-style-ui`, `rest-timer`, `pwa-offline-sync`)

# Workflow
1. Receive exact file paths and task description from the orchestrator.
2. Implement the UI components using Vite, React, and TypeScript.
3. Apply the specific design tokens, typography, and styling rules.
4. Implement the offline-first IndexedDB (Dexie) local storage and sync queue mechanism.
5. Build the rest timer utilizing Wake Lock and `visibilitychange` to handle throttling.
6. Return a completion status.

# Rules
- Strictly apply the calm, flat, Notion-like design rules (no gradients, no em-dashes, use system sans and tabular numerals).
- Implement dark theme by default, light available.
- Ensure touch targets are at least 48px.
- Use lightweight Lucide icons.
- Avoid all marketing copy and exclamation marks; use sentence case everywhere.

# Definition of Done
The requested components render correctly across 360px to 412px viewports, respect the Notion-style design constraints, and function entirely offline using IndexedDB.

# Handoff Format
List the created or modified file paths and summarize the structural changes made.
EOF

cat << 'EOF' > .opencode/agents/backend.md
# Role
You build the Cloudflare Worker API, D1 database migrations, authentication, sync endpoints, and the Web Push cron trigger.

# Inputs
- Targeted source files (e.g., `api/src/index.ts`, `api/migrations/*.sql`)
- Relevant skills loaded as needed (`cloudflare-stack`, `web-push-reminders`)

# Workflow
1. Receive exact file paths and task description from the orchestrator.
2. Write D1 schema migrations matching the required data model (`sessions`, `set_logs`, `body_metrics`, `settings`, `push_subscriptions`).
3. Build the sync endpoints to merge queued data from the client (last write wins by `updated_at`, using soft deletes).
4. Implement single-user authentication: validate the Worker secret passphrase and issue a long-lived token.
5. Setup the Cron Trigger for Web Push reminders.

# Rules
- Design the API to stay comfortably within the Cloudflare D1 free-tier limits (max 100k writes/day, 5M reads/day).
- Validate all incoming payloads against the expected schema.
- Use Web Crypto (or a Cloudflare-compatible library like `@mmmike/web-push`) for VAPID signing, avoiding Node-specific crypto modules.

# Definition of Done
The Worker compiles within the 64 MiB limit, endpoints return valid JSON responses, database schemas are applied locally, and the sync logic accurately resolves timestamp conflicts.

# Handoff Format
List the created or modified API routes and database tables. Name any environment variables or secrets that must be set.
EOF

cat << 'EOF' > .opencode/agents/plan-data.md
# Role
You parse workout content and generate the static `plan.json` configuration, ensuring all exercise data validates against the application schema.

# Inputs
- `content/*.md`
- Relevant skills loaded as needed (`plan-data-and-progression`)

# Workflow
1. Read the provided workout Markdown files (`workout-1-pull.md`, etc.).
2. Extract the structured data for each exercise: equipment, rep ranges, sets, rest times, and band default.
3. Determine boolean flags (e.g., `unilateral`, `supersetGroup`, `optional`) based on the text.
4. Construct the output `plan.json` strictly matching the required schema.
5. Set up the `app/public/gallery/<exercise-slug>/` directory structure and a `media.json` mapping.

# Rules
- Accurately map band labels (T for tube, L for loop) and starting values.
- Retain exact exercise names and instructions.
- Validate that all required schema fields (`slug`, `name`, `equipment`, `repMin`, `repMax`, `sets`, `restSeconds`, `startBand`) are present.
- Never invent metrics not present in the markdown source.

# Definition of Done
`plan.json` is generated, correctly formatted, and completely represents the source of truth in the `content/` files. Gallery directories exist for every `slug`.

# Handoff Format
List the generated JSON file paths and output a checklist of media directories created for the user to populate.
EOF

cat << 'EOF' > .opencode/agents/reviewer.md
# Role
You review milestone deliverables against the brief's rules, execute tests, and enforce quality assurance. You write no feature code.

# Inputs
- `docs/progress.md`
- Application source code and configuration files.

# Workflow
1. Receive a review request from the orchestrator for a specific milestone.
2. Run build, lint, and test scripts.
3. Validate the UI against the design checklist: ensure no em-dashes, no uppercase transforms, exact hex codes for light/dark mode, and tabular numerals.
4. Ensure mobile responsive layout works flawlessly at 360px and 412px widths.
5. Verify that offline operation and IndexedDB sync queues function as intended.

# Rules
- Do not modify files directly; your job is strictly read and report.
- Be meticulous about the Notion-style UI constraints and typography rules.
- Flag any use of marketing copy, heavy shadows, or unsupported gradients.

# Definition of Done
All necessary build checks, UI heuristic validations, and sync queue tests are executed.

# Handoff Format
Return a clear pass or fail list. For every failure, provide the exact file path, line number, and a brief description of the violation.
EOF

echo "Writing Skills..."
cat << 'EOF' > .opencode/skills/notion-style-ui/SKILL.md
---
name: Notion Style UI
description: Design tokens, layout rules, and the banned patterns for UI implementation.
---

# Design Rules

Reference: the Notion website and app. Calm, flat, document-like.

## Do
1. Use the system sans font stack: `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`. Use tabular numerals for all numbers and timers.
2. Use Sentence case everywhere.
3. Page titles: ~28px, bold. Body: 16px.
4. Surfaces: Flat, 1px borders, 4-6px border radius, generous whitespace, left-aligned content. Almost no shadows.
5. Touch targets: Minimum 48px.
6. Icons: Simple outline icons (Lucide) or none at all.
7. **Dark Tokens (Default)**:
   - background: `#191919`
   - surface: `#202020`
   - hover: `#2A2A2A`
   - border: `#2F2F2F`
   - text: `#EBEBEB`
   - secondary text: `#9B9B9B`
   - accent: `#529CCA`
8. **Light Tokens**:
   - background: `#FFFFFF`
   - surface: `#F7F6F3`
   - hover: `#EFEEEC`
   - border: `#E9E9E7`
   - text: `#37352F`
   - secondary text: `#787774`
   - accent: `#2383E2`

## Never
1. No em dashes (—) or en dashes (–) in UI text. No center dots (·) as separators; use commas or line breaks.
2. No monospace fonts in the UI.
3. No large all-caps titles or `text-transform: uppercase`.
4. No gradients, glows, sparkle icons, neon colours, glassmorphism, heavy shadows, or emoji overload.
5. No marketing-style copy or exclamation marks.
EOF

cat << 'EOF' > .opencode/skills/plan-data-and-progression/SKILL.md
---
name: Plan Data and Progression
description: JSON schema rules, band ladders, progression logic, and due prompts.
---

# Band Ladders (lb)
- **Tube (T)**: `30`, `40`, `50`, `30+40`, `40+50`, `30+40+50`
- **Loop (L)**: `5-30`, `15-50`, `25-75`, `35-95`, `50-145`

# Schema Notes
Each exercise requires: `slug`, `name`, `equipment`, `repMin`, `repMax`, `sets`, `restSeconds`, `startBand`, `unilateral`, `supersetGroup`, `optional`.
*Note: Unilateral exercises (e.g., Side pull biceps) require one logged set per side.*

# Progression Suggestion Rule
Evaluate after a session for each exercise:
1. **Next Band**: If *every* set hit `repMax` with the same band, suggest the next band on the ladder (or "single-arm" if already at the top).
2. **Hold**: If *any* set is under `repMin`, suggest staying on the current band.
3. Show the suggestion as a note on the exercise card during the next session.

# Due Prompts
- **Arm Measurement**: Prompt due every 4 weeks.
- **Deload Week**: Prompt due every 6 to 8 weeks (instruct the user to do half the sets with the same bands).
EOF

cat << 'EOF' > .opencode/skills/pwa-offline-sync/SKILL.md
---
name: PWA Offline Sync
description: Service worker configuration, Dexie stores, sync queue, and conflict resolution.
---

# Offline-First Architecture

## PWA Setup
- Use `vite-plugin-pwa` to generate the service worker and web manifest.
- Configure for installability on Android (Chrome).

## IndexedDB (Dexie) Schema
Implement a local-first store mirroring the D1 backend:
1. `sessions`: id (UUID), workout_id, date, started_at, ended_at, note, updated_at, deleted
2. `set_logs`: id (UUID), session_id, exercise_slug, set_index, side (null, L, R), reps, band, note, updated_at, deleted
3. `body_metrics`: id (UUID), date, type, value, updated_at, deleted
4. `settings`: key, value, updated_at, deleted

## Sync Queue & Conflict Resolution
- All writes happen locally in Dexie first.
- A background queue pushes local mutations to the API.
- **Resolution Rule**: Last write wins based strictly on the `updated_at` timestamp.
- **Deletions**: Use soft deletes (`deleted: true`) so records can be reliably synced to the backend before being purged.
EOF

cat << 'EOF' > .opencode/skills/rest-timer/SKILL.md
---
name: Rest Timer
description: Timer logic, Wake Lock API, superset exceptions, and background handling.
---

# Timer Implementation

## Core Logic
- The timer relies on absolute timestamps (`endTime`), not a running interval counter.
- Recompute the remaining time on the `visibilitychange` event. This ensures accuracy even if the browser aggressively throttles the inactive tab.
- Provide controls: -15s, +15s, and Skip.
- Play a short chime and trigger a vibration upon completion.

## Device API Usage
- Use the Screen Wake Lock API (`navigator.wakeLock.request('screen')`) to keep the screen awake during the session.
- **Known Limit**: The Web App cannot play audio or ring if the user manually locks the screen. State this limitation clearly in the UI.

## Exceptions
1. **Supersets**: The timer does not start after the first exercise of a pair. It starts only after the second exercise is logged.
2. **Unilateral Exercises**: The timer starts only after the second side is logged.
EOF

cat << 'EOF' > .opencode/skills/cloudflare-stack/SKILL.md
---
name: Cloudflare Stack
description: Setup rules and free-tier limitations for Pages, Workers, and D1.
---

# Infrastructure Configuration

## Deployments
- **Frontend**: Deploy the static React PWA to Cloudflare Pages.
- **Backend**: Deploy the API to Cloudflare Workers using Wrangler for local dev.

## D1 Database
- Apply schema migrations via Wrangler (`wrangler d1 migrations apply`).
- **Free-Tier Limits**:
  - Max 5 million rows read per day.
  - Max 100,000 rows written per day.
  - Max 5 GB total storage.
- Ensure queries are efficient and batch sync updates to preserve write limits.

## Workers Limits & Security
- Worker bundle size must stay under 64 MiB.
- Store the authentication passphrase as a secure Worker secret, never in plaintext.
- Use Cloudflare Cron Triggers for the scheduled push notification jobs.
EOF

cat << 'EOF' > .opencode/skills/web-push-reminders/SKILL.md
---
name: Web Push Reminders
description: VAPID key handling, Android subscription flow, and Web Crypto requirements.
---

# Web Push Implementation

## Client Subscription
- Trigger the subscription flow natively on Android Chrome.
- Only request notification permission when the user toggles a reminder on in Settings.
- Store the generated subscription object in the backend `push_subscriptions` table.

## Server-Side Push (Worker)
- The Node `crypto` library does not work on Cloudflare Workers.
- You must use the Web Crypto API to sign the VAPID JWT (ES256) and handle payload encryption.
- Use a Web Crypto compatible library (like `@mmmike/web-push`) to send the notifications directly from the edge.
- Store the VAPID public and private keys as Cloudflare Worker secrets.

## Cron Trigger
- Create a scheduled Worker handler (`scheduled` event) that evaluates user settings.
- Send the morning weigh-in reminder and any other configured prompts at the user-defined times.
EOF

echo "All OpenCode agent, skill, config, and prompt files have been successfully generated!"