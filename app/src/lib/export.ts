import { db, type Session, type SetLog, type BodyMetric } from '../db/db'

// Column headers for each section. Each section in the file is a plain label
// line, its own header row, then the data rows. Sections are separated by a
// single blank line.
const SESSION_COLUMNS = ['date', 'workout_id', 'started_at', 'ended_at', 'note']
const SET_LOG_COLUMNS = [
  'session_date',
  'workout_id',
  'exercise_slug',
  'set_index',
  'side',
  'reps',
  'band',
  'note',
]
const BODY_METRIC_COLUMNS = ['date', 'type', 'value']

// Escape a single CSV field. Blank for null/undefined. A field is wrapped in
// double quotes (with any embedded quotes doubled) when it contains a comma,
// a quote, or a line break, so notes with commas do not break the file.
function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"'
  }
  return text
}

function csvRow(fields: Array<string | number | null | undefined>): string {
  return fields.map(csvField).join(',')
}

function section(label: string, columns: string[], rows: string[]): string {
  const lines = [label, columns.join(',')]
  for (const row of rows) lines.push(row)
  return lines.join('\n')
}

export async function exportToCsv(): Promise<void> {
  const sessions = await db.sessions.filter((s) => !s.deleted).toArray()
  const setLogs = await db.set_logs.filter((l) => !l.deleted).toArray()
  const bodyMetrics = await db.body_metrics.filter((m) => !m.deleted).toArray()

  // Join each set log to its session for session_date and workout_id.
  const sessionById = new Map<string, Session>(sessions.map((s) => [s.id, s]))

  const sessionRows = sessions.map((s: Session) =>
    csvRow([s.date, s.workout_id, s.started_at, s.ended_at, s.note])
  )

  const setLogRows = setLogs.map((l: SetLog) => {
    const session = sessionById.get(l.session_id)
    return csvRow([
      session?.date ?? '',
      session?.workout_id ?? '',
      l.exercise_slug,
      l.set_index,
      l.side, // null becomes blank
      l.reps,
      l.band,
      l.note,
    ])
  })

  const bodyMetricRows = bodyMetrics.map((m: BodyMetric) =>
    csvRow([m.date, m.type, m.value])
  )

  const sections = [
    section('sessions', SESSION_COLUMNS, sessionRows),
    section('set_logs', SET_LOG_COLUMNS, setLogRows),
    section('body_metrics', BODY_METRIC_COLUMNS, bodyMetricRows),
  ]

  const csv = sections.join('\n\n') + '\n'

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'fitness-tracker-export.csv'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoke after the download has started so the blob is released.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
