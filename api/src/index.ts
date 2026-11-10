// Cloudflare Worker API for the loop-fitness PWA.
// Single-user auth (passphrase -> token), last-write-wins sync over D1, and
// Web Push reminders driven by a cron trigger.
// Reference: docs/fitness-app-brief.md, sections 2, 5 and 6.

import { sendPushNotification, WebPushError, type PushSubscriptionData } from '@mmmike/web-push/send'

const TABLES = ['sessions', 'set_logs', 'body_metrics', 'settings', 'nutrition'] as const
type TableName = (typeof TABLES)[number]

// Column lists per table (must match api/migrations/0001_init.sql).
const TABLE_COLUMNS: Record<TableName, string[]> = {
  sessions: ['id', 'workout_id', 'date', 'started_at', 'ended_at', 'note', 'updated_at', 'deleted'],
  set_logs: ['id', 'session_id', 'exercise_slug', 'set_index', 'side', 'reps', 'band', 'note', 'updated_at', 'deleted'],
  body_metrics: ['id', 'date', 'type', 'value', 'updated_at', 'deleted'],
  settings: ['key', 'value', 'updated_at', 'deleted'],
  nutrition: ['id', 'date', 'calories', 'protein', 'updated_at', 'deleted'],
}

interface Env {
  DB: D1Database
  PASSPHRASE: string
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
}

// The VAPID contact subject. RFC 8292 requires a valid URI; a mailto: URI is
// the conventional choice for a personal app.
const VAPID_SUBJECT = 'mailto:tristan@loop-fitness.local'

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// The long-lived token is the SHA-256 of the passphrase. Stateless: the server
// recomputes it from the secret on every request, so no token table is needed.
async function expectedToken(env: Env): Promise<string> {
  return sha256Hex(env.PASSPHRASE)
}

// Constant-time string comparison (timingSafeEqual requires equal lengths; the
// length of the expected token is not secret).
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  if (ab.byteLength !== bb.byteLength) return false
  return crypto.subtle.timingSafeEqual(ab, bb)
}

async function isAuthorized(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (token.length === 0) return false
  return safeEqual(token, await expectedToken(env))
}

async function handleAuth(request: Request, env: Env): Promise<Response> {
  let body: { passphrase?: string }
  try {
    body = (await request.json()) as { passphrase?: string }
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400)
  }
  const provided = await sha256Hex(body.passphrase ?? '')
  const expected = await expectedToken(env)
  if (!safeEqual(provided, expected)) {
    return json({ ok: false, error: 'invalid passphrase' }, 401)
  }
  return json({ ok: true, token: expected })
}

function coerce(value: unknown): unknown {
  if (value === undefined) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  return value
}

async function handlePush(request: Request, env: Env): Promise<Response> {
  let body: { records?: Record<string, unknown[]> }
  try {
    body = (await request.json()) as { records?: Record<string, unknown[]> }
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400)
  }
  const records = body.records ?? {}
  const batches: D1PreparedStatement[] = []
  const rejected: Record<string, string[]> = {}

  for (const table of TABLES) {
    const rows = records[table]
    if (!Array.isArray(rows)) continue
    const cols = TABLE_COLUMNS[table]
    const pk = table === 'settings' ? 'key' : 'id'
    const updateCols = cols.filter((c) => c !== pk)
    const setClause = updateCols.map((c) => `${c} = excluded.${c}`).join(', ')
    const placeholders = cols.map(() => '?').join(', ')
    const sql =
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ` +
      `ON CONFLICT(${pk}) DO UPDATE SET ${setClause} ` +
      `WHERE excluded.updated_at >= ${table}.updated_at`

    for (const row of rows) {
      const rec = row as Record<string, unknown>
      const recId = rec ? rec[pk] : undefined
      if (!rec || typeof recId !== 'string' || recId.length === 0 || typeof rec.updated_at !== 'string') {
        // Skip invalid rows rather than failing the whole batch, and report them
        // so the client can drop them instead of retrying forever.
        if (rec && typeof recId === 'string') (rejected[table] ??= []).push(recId)
        continue
      }
      const values = cols.map((c) => coerce(rec[c]))
      batches.push(env.DB.prepare(sql).bind(...(values as unknown[])))
    }
  }

  if (batches.length > 0) {
    await env.DB.batch(batches)
  }
  return json({ ok: true, written: batches.length, rejected })
}

function normalizeRow(table: TableName, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row }
  out.deleted = row.deleted === 1 || row.deleted === true
  return out
}

async function handlePull(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const since = url.searchParams.get('since') ?? ''
  const result: Record<string, unknown[]> = {}
  for (const table of TABLES) {
    const stmt = env.DB.prepare(`SELECT * FROM ${table} WHERE updated_at > ?`).bind(since)
    const { results } = await stmt.all()
    result[table] = (results ?? []).map((r) => normalizeRow(table, r as Record<string, unknown>))
  }
  return json({ ok: true, ...result })
}

// --- Web Push reminders -----------------------------------------------------

// The VAPID public key, URL-safe base64. The client uses it to subscribe.
function handleVapidPublicKey(env: Env): Response {
  return json({ publicKey: env.VAPID_PUBLIC_KEY })
}

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

// Store a subscription. The client POSTs the serialized PushSubscriptionData
// (endpoint + p256dh/auth keys). Upsert by endpoint so re-subscribing is safe.
async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400)
  }
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return json({ ok: false, error: 'missing endpoint or keys' }, 400)
  }
  if (!isHttpsUrl(body.endpoint)) {
    return json({ ok: false, error: 'endpoint must be an https URL' }, 400)
  }
  const now = new Date().toISOString()
  const sql =
    `INSERT INTO push_subscriptions (id, endpoint, keys, updated_at, deleted) ` +
    `VALUES (?, ?, ?, ?, 0) ` +
    `ON CONFLICT(id) DO UPDATE SET endpoint = excluded.endpoint, keys = excluded.keys, ` +
    `updated_at = excluded.updated_at, deleted = 0`
  await env.DB.prepare(sql).bind(body.endpoint, body.endpoint, JSON.stringify(body.keys), now).run()
  return json({ ok: true })
}

// Remove a subscription by endpoint (the client calls this on unsubscribe).
async function handleUnsubscribe(request: Request, env: Env): Promise<Response> {
  let body: { endpoint?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400)
  }
  if (!body.endpoint) return json({ ok: false, error: 'missing endpoint' }, 400)
  const now = new Date().toISOString()
  await env.DB.prepare(
    `UPDATE push_subscriptions SET deleted = 1, updated_at = ? WHERE endpoint = ?`
  )
    .bind(now, body.endpoint)
    .run()
  return json({ ok: true })
}

// Read the reminder settings for the single user. All reminders default off.
// - enabled: weigh-in reminder on or off
// - time: local time to send, "HH:MM" (24h)
// - offset: the device's UTC offset in minutes, so the UTC cron can compute
//   the user's local time
// - lastSent: the local calendar date (YYYY-MM-DD) the reminder was last sent,
//   guarding against a double send within the cron window
async function getReminderSettings(env: Env): Promise<{
  enabled: boolean
  time: string
  offset: number
  lastSent: string
}> {
  const { results } = await env.DB.prepare(
    `SELECT key, value FROM settings WHERE deleted = 0 AND key IN ` +
      `('reminder_weighin_enabled', 'reminder_weighin_time', 'reminder_timezone_offset', 'reminder_weighin_last_sent')`
  ).all()
  const map: Record<string, string> = {}
  for (const row of results ?? []) {
    map[String((row as Record<string, unknown>).key)] = String((row as Record<string, unknown>).value)
  }
  return {
    enabled: map['reminder_weighin_enabled'] === '1',
    time: map['reminder_weighin_time'] ?? '08:00',
    offset: Number(map['reminder_timezone_offset'] ?? 0),
    lastSent: map['reminder_weighin_last_sent'] ?? '',
  }
}

// The cron trigger runs every 15 minutes (see wrangler.jsonc). It computes the
// user's local time from the stored UTC offset and sends the weigh-in reminder
// when the current local time falls in the 15-minute window that starts at the
// configured time. A once-per-day guard (lastSent) makes it idempotent.
async function runReminders(env: Env): Promise<void> {
  const { enabled, time, offset, lastSent } = await getReminderSettings(env)
  if (!enabled) return

  const localNowMs = Date.now() + offset * 60000
  const localDate = new Date(localNowMs).toISOString().slice(0, 10)
  if (lastSent === localDate) return

  const localMinutes = Math.floor(localNowMs / 60000) % 1440
  const [hh, mm] = time.split(':').map((n) => Number(n))
  const targetMinutes = hh * 60 + mm
  // The reminder fires in the 15-minute window that starts at the target time.
  // The modulo handles the midnight wrap (e.g. a 23:50 target also covers the
  // first minutes of the next day).
  const inWindow = (localMinutes - targetMinutes + 1440) % 1440 < 15
  if (!inWindow) return

  const { results } = await env.DB.prepare(
    `SELECT endpoint, keys FROM push_subscriptions WHERE deleted = 0`
  ).all()
  const subs = (results ?? []) as { endpoint: string; keys: string }[]
  if (subs.length === 0) return

  const vapid = {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: VAPID_SUBJECT,
  }
  const payload = {
    title: 'Time to weigh in',
    body: `Log today's weight at ${time}.`,
    url: '/progress',
    tag: 'weighin',
  }

  let anySent = false
  for (const sub of subs) {
    let keys: { p256dh: string; auth: string }
    try {
      keys = JSON.parse(sub.keys) as { p256dh: string; auth: string }
    } catch {
      continue
    }
    const subscription: PushSubscriptionData = {
      endpoint: sub.endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
    }
    try {
      const delivered = await sendPushNotification(subscription, payload, vapid)
      if (delivered) {
        anySent = true
      } else {
        await env.DB.prepare(
          `UPDATE push_subscriptions SET deleted = 1, updated_at = ? WHERE endpoint = ?`
        )
          .bind(new Date().toISOString(), sub.endpoint)
          .run()
      }
    } catch (err) {
      // Rate limits and transient push-service errors are not fatal; the next
      // cron run retries. Gone subscriptions already resolved to `false` above.
      if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
        await env.DB.prepare(
          `UPDATE push_subscriptions SET deleted = 1, updated_at = ? WHERE endpoint = ?`
        )
          .bind(new Date().toISOString(), sub.endpoint)
          .run()
      } else {
        console.error('push send failed', err)
      }
    }
  }

  // Only record the send if at least one delivery succeeded, so a total
  // failure is retried on the next cron run within the window.
  if (!anySent) return
  // Record the send so the 15-minute window does not fire twice.
  await env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at, deleted) VALUES (?, ?, ?, 0) ` +
      `ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, deleted = 0`
  )
    .bind('reminder_weighin_last_sent', localDate, new Date().toISOString())
    .run()
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() })
    }

    try {
      if (path === '/health') {
        return json({ ok: true })
      }
      if (path === '/auth' && request.method === 'POST') {
        return await handleAuth(request, env)
      }
      if (path === '/sync/push' && request.method === 'POST') {
        if (!(await isAuthorized(request, env))) return json({ ok: false, error: 'unauthorized' }, 401)
        return await handlePush(request, env)
      }
      if (path === '/sync/pull' && request.method === 'GET') {
        if (!(await isAuthorized(request, env))) return json({ ok: false, error: 'unauthorized' }, 401)
        return await handlePull(request, env)
      }
      if (path === '/push/vapid-public-key' && request.method === 'GET') {
        return handleVapidPublicKey(env)
      }
      if (path === '/push/subscribe' && request.method === 'POST') {
        if (!(await isAuthorized(request, env))) return json({ ok: false, error: 'unauthorized' }, 401)
        return await handleSubscribe(request, env)
      }
      if (path === '/push/unsubscribe' && request.method === 'POST') {
        if (!(await isAuthorized(request, env))) return json({ ok: false, error: 'unauthorized' }, 401)
        return await handleUnsubscribe(request, env)
      }
      return json({ ok: false, error: 'not found' }, 404)
    } catch (err) {
      console.error('unhandled error', err)
      return json({ ok: false, error: 'internal error' }, 500)
    }
  },

  // Cron trigger: runs on the schedule set in wrangler.jsonc. Sends the
  // weigh-in reminder (and any other enabled reminders) at their times.
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    await runReminders(env)
  },
}
