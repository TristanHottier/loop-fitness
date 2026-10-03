// Cloudflare Worker API for the loop-fitness PWA.
// Single-user auth (passphrase -> token) and last-write-wins sync over D1.
// Reference: docs/fitness-app-brief.md, sections 2 and 5.

const TABLES = ['sessions', 'set_logs', 'body_metrics', 'settings'] as const
type TableName = (typeof TABLES)[number]

// Column lists per table (must match api/migrations/0001_init.sql).
const TABLE_COLUMNS: Record<TableName, string[]> = {
  sessions: ['id', 'workout_id', 'date', 'started_at', 'ended_at', 'note', 'updated_at', 'deleted'],
  set_logs: ['id', 'session_id', 'exercise_slug', 'set_index', 'side', 'reps', 'band', 'note', 'updated_at', 'deleted'],
  body_metrics: ['id', 'date', 'type', 'value', 'updated_at', 'deleted'],
  settings: ['key', 'value', 'updated_at', 'deleted'],
}

interface Env {
  DB: D1Database
  PASSPHRASE: string
}

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

async function isAuthorized(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (token.length === 0) return false
  return token === (await expectedToken(env))
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
  if (provided !== expected) {
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
      if (!rec || typeof rec.id !== 'string' && typeof rec.key !== 'string') continue
      if (typeof rec.updated_at !== 'string') continue
      const values = cols.map((c) => coerce(rec[c]))
      batches.push(env.DB.prepare(sql).bind(...(values as unknown[])))
    }
  }

  if (batches.length > 0) {
    await env.DB.batch(batches)
  }
  return json({ ok: true, written: batches.length })
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
      return json({ ok: false, error: 'not found' }, 404)
    } catch (err) {
      return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500)
    }
  },
}
