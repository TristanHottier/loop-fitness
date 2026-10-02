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
