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
