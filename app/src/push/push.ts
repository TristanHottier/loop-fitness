// Web Push client for the loop-fitness PWA.
// Subscribes the device to push notifications, stores the subscription on the
// Worker, and persists the reminder settings (enabled, time, timezone offset)
// so the cron trigger can send the weigh-in reminder at the right local time.
// Reference: docs/fitness-app-brief.md, section 6 (reminders).

import {
  subscribe,
  unsubscribe,
  serializeSubscription,
  isPushSupported,
  type SubscribeResult,
} from '@mmmike/web-push/client'
import { getApiBase, getToken } from '../sync/sync'
import { setSetting, getSetting } from '../db/db'

// Settings keys (synced to the Worker via the settings outbox).
export const REMINDER_ENABLED_KEY = 'reminder_weighin_enabled'
export const REMINDER_TIME_KEY = 'reminder_weighin_time'
export const REMINDER_TZ_OFFSET_KEY = 'reminder_timezone_offset'

// The device's UTC offset in minutes, captured so the UTC cron can compute the
// user's local time. Recomputed whenever a reminder is enabled or its time
// changes, so it tracks the device's current timezone.
function currentUtcOffsetMinutes(): number {
  return -new Date().getTimezoneOffset()
}

// POST JSON to an authenticated push endpoint; throws on failure so callers
// do not report success when the Worker rejected the request.
async function postAuthed(path: string, payload: unknown): Promise<void> {
  const token = getToken()
  if (!token) throw new Error('not authenticated')
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`${path} failed (${res.status})`)
}

// Fetch the Worker's VAPID public key (URL-safe base64).
async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch(`${getApiBase()}/push/vapid-public-key`)
  if (!res.ok) throw new Error(`vapid key failed (${res.status})`)
  const data = (await res.json()) as { publicKey: string }
  return data.publicKey
}

// Subscribe the device and store the subscription on the Worker. Resolves to
// the subscribe outcome so the caller can surface a permission denial.
export async function enablePush(): Promise<SubscribeResult> {
  if (!isPushSupported()) {
    return { status: 'unsupported' }
  }
  const publicKey = await fetchVapidPublicKey()
  const result = await subscribe(publicKey)
  if (result.status === 'subscribed') {
    const data = serializeSubscription(result.subscription)
    await postAuthed('/push/subscribe', data)
  }
  return result
}

// Unsubscribe the device and prune the subscription on the Worker.
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return
  const endpoint = await unsubscribe()
  if (endpoint) {
    await postAuthed('/push/unsubscribe', { endpoint })
  }
}

// Persist the weigh-in reminder settings. The timezone offset is captured at
// this moment so the cron trigger computes the user's local time correctly.
export async function saveReminderSettings(enabled: boolean, time: string): Promise<void> {
  await setSetting(REMINDER_ENABLED_KEY, enabled ? '1' : '0')
  await setSetting(REMINDER_TIME_KEY, time)
  await setSetting(REMINDER_TZ_OFFSET_KEY, String(currentUtcOffsetMinutes()))
}

// Read the stored reminder settings. Defaults: off, 08:00.
export async function loadReminderSettings(): Promise<{ enabled: boolean; time: string }> {
  const [enabled, time] = await Promise.all([
    getSetting(REMINDER_ENABLED_KEY),
    getSetting(REMINDER_TIME_KEY),
  ])
  return {
    enabled: enabled === '1',
    time: time ?? '08:00',
  }
}
