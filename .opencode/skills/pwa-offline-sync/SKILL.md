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
