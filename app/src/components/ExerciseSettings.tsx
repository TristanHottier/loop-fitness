import { useEffect, useState } from 'react'
import { loadPlan, type PlanData } from '../data/plan'
import {
  DEFAULT_VOLUME_TARGETS,
  getExerciseOverrides,
  getVolumeTargets,
  setExerciseOverride,
  setVolumeTargets,
  type ExerciseOverride,
  type ProgressionRule,
} from '../db/config'
import './band-inventory.css'

const RULE_LABELS: Record<ProgressionRule, string> = {
  'all-sets-max': 'Every set at the top of the range',
  'total-reps': 'Total reps target',
  'two-of-three': 'Top of the range in 2 of 3 sessions',
}

const RULES = Object.keys(RULE_LABELS) as ProgressionRule[]

function positiveInt(raw: string): number | null {
  const n = Number(raw.trim())
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

export function VolumeTargetsSettings() {
  const [volMin, setVolMin] = useState(String(DEFAULT_VOLUME_TARGETS.min))
  const [volMax, setVolMax] = useState(String(DEFAULT_VOLUME_TARGETS.max))
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getVolumeTargets()
      .then((v) => {
        if (cancelled) return
        setVolMin(String(v.min))
        setVolMax(String(v.max))
      })
      .catch(() => {
        if (!cancelled) setError('Could not load volume targets.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function commitVolume() {
    const min = Number(volMin)
    const max = Number(volMax)
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
      setError('Weekly volume needs a min of 0 or more and a max at least as large.')
      return
    }
    setError('')
    try {
      await setVolumeTargets({ min: Math.round(min), max: Math.round(max) })
    } catch {
      setError('Could not save. Try again.')
    }
  }

  return (
    <div className="settings-sync-card">
      <span className="settings-label">Weekly volume target, sets per muscle</span>
      <div className="settings-row">
        <label className="settings-label" htmlFor="vol-min">
          Minimum
        </label>
        <input
          id="vol-min"
          className="settings-time-input exercise-settings-number"
          type="number"
          inputMode="numeric"
          min="0"
          value={volMin}
          onChange={(e) => setVolMin(e.target.value)}
          onBlur={() => void commitVolume()}
        />
      </div>
      <div className="settings-row">
        <label className="settings-label" htmlFor="vol-max">
          Maximum
        </label>
        <input
          id="vol-max"
          className="settings-time-input exercise-settings-number"
          type="number"
          inputMode="numeric"
          min="0"
          value={volMax}
          onChange={(e) => setVolMax(e.target.value)}
          onBlur={() => void commitVolume()}
        />
      </div>
      {error && <p className="settings-note settings-status-error">{error}</p>}
    </div>
  )
}

export function ExerciseSettings() {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [overrides, setOverrides] = useState<Record<string, ExerciseOverride>>({})
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([loadPlan(), getExerciseOverrides()])
      .then(([p, o]) => {
        if (cancelled) return
        setPlan(p)
        setOverrides(o)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load exercise settings.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function update(slug: string, partial: Partial<ExerciseOverride>) {
    setError('')
    try {
      await setExerciseOverride(slug, partial)
      setOverrides(await getExerciseOverrides())
    } catch {
      setError('Could not save. Try again.')
    }
  }

  if (!plan) {
    return <p className="settings-note">{error || 'Loading exercises'}</p>
  }

  const exercises = Object.values(plan.exercises)

  return (
    <>
      <div className="settings-sync-card">
        <p className="settings-note">
          Tap an exercise to choose when the app suggests a heavier band, and how long to rest.
        </p>
        {exercises.map((ex) => {
          const ov = overrides[ex.slug] ?? {}
          const rule = ov.rule ?? 'all-sets-max'
          const isOpen = openSlug === ex.slug
          const restKey = `${ex.slug}:rest`
          const totalKey = `${ex.slug}:total`
          const customized = ov.rule !== undefined || ov.restSeconds !== undefined || ov.totalRepsTarget !== undefined
          return (
            <div key={ex.slug} className="exercise-settings-item">
              <button
                type="button"
                className="exercise-settings-head"
                aria-expanded={isOpen}
                onClick={() => setOpenSlug(isOpen ? null : ex.slug)}
              >
                <span>{ex.name}</span>
                <span className="exercise-settings-summary">{customized ? 'Customized' : 'Default'}</span>
              </button>
              {isOpen && (
                <div className="exercise-settings-body">
                  <div className="settings-row">
                    <label className="settings-label" htmlFor={`rule-${ex.slug}`}>
                      Progression rule
                    </label>
                    <select
                      id={`rule-${ex.slug}`}
                      className="exercise-settings-select"
                      value={rule}
                      onChange={(e) =>
                        void update(ex.slug, {
                          rule: e.target.value === 'all-sets-max' ? undefined : (e.target.value as ProgressionRule),
                        })
                      }
                    >
                      {RULES.map((r) => (
                        <option key={r} value={r}>
                          {RULE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {rule === 'total-reps' && (
                    <div className="settings-row">
                      <label className="settings-label" htmlFor={`total-${ex.slug}`}>
                        Total reps target
                      </label>
                      <input
                        id={`total-${ex.slug}`}
                        className="settings-time-input exercise-settings-number"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        placeholder={String(ex.sets * ex.repMax)}
                        value={drafts[totalKey] ?? (ov.totalRepsTarget !== undefined ? String(ov.totalRepsTarget) : '')}
                        onChange={(e) => setDrafts({ ...drafts, [totalKey]: e.target.value })}
                        onBlur={() => {
                          const raw = drafts[totalKey]
                          if (raw === undefined) return
                          void update(ex.slug, { totalRepsTarget: positiveInt(raw) ?? undefined })
                          setDrafts((d) => {
                            const { [totalKey]: _drop, ...rest } = d
                            return rest
                          })
                        }}
                      />
                    </div>
                  )}
                  <div className="settings-row">
                    <label className="settings-label" htmlFor={`rest-${ex.slug}`}>
                      Rest, seconds
                    </label>
                    <input
                      id={`rest-${ex.slug}`}
                      className="settings-time-input exercise-settings-number"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      placeholder={String(ex.restSeconds)}
                      value={drafts[restKey] ?? (ov.restSeconds !== undefined ? String(ov.restSeconds) : '')}
                      onChange={(e) => setDrafts({ ...drafts, [restKey]: e.target.value })}
                      onBlur={() => {
                        const raw = drafts[restKey]
                        if (raw === undefined) return
                        void update(ex.slug, { restSeconds: positiveInt(raw) ?? undefined })
                        setDrafts((d) => {
                          const { [restKey]: _drop, ...rest } = d
                          return rest
                        })
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {error && <p className="settings-note settings-status-error">{error}</p>}
      </div>
    </>
  )
}
