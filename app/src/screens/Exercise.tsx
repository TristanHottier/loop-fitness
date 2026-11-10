import { useEffect, useState } from 'react'
import { loadMedia, loadPlan, resolveExercise } from '../data/plan'
import type { MediaMap, PlanData } from '../data/plan'
import { BackButton } from '../components/BackButton'
import { MuscleMap } from '../components/MuscleMap'
import { StrengthChart } from '../components/StrengthChart'
import { useTrainingData } from '../components/useTrainingData'
import { exerciseHistory, recordsByBand } from '../lib/analytics'
import './exercise.css'

const EQUIPMENT_WORDS: Record<string, string> = {
  T: 'Tube band',
  L: 'Loop band',
  'T + Pilates bar': 'Tube band with Pilates bar',
  'T + handles': 'Tube band with handles',
}

function equipmentWord(code: string): string {
  return EQUIPMENT_WORDS[code] ?? code.replace(/\bT\b/g, 'Tube band').replace(/\bL\b/g, 'Loop band').replace(' + ', ' with ')
}

function Collapsible({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="exercise-section exercise-collapsible">
      <button type="button" className="prop-row exercise-collapsible-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="exercise-collapsible-title">{title}</span>
        <span aria-hidden="true">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? <div className="exercise-collapsible-body">{children}</div> : null}
    </section>
  )
}

function youtubeId(value: string): string {
  const patterns = [
    /youtube\.com\/embed\/([\w-]+)/,
    /youtube\.com\/watch\?v=([\w-]+)/,
    /youtu\.be\/([\w-]+)/,
  ]
  for (const pattern of patterns) {
    const match = value.match(pattern)
    if (match) return match[1]
  }
  return value
}

export function Exercise({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [media, setMedia] = useState<MediaMap | null>(null)
  const [failed, setFailed] = useState(false)
  const training = useTrainingData([slug])

  useEffect(() => {
    let cancelled = false
    Promise.all([loadPlan(), loadMedia()])
      .then(([planData, mediaMap]) => {
        if (cancelled) return
        setPlan(planData)
        setMedia(mediaMap)
      })
      .catch(() => {
        if (cancelled) return
        setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const workout = plan ? plan.workouts.find((w) => w.exercises.includes(slug)) : undefined
  const entry = media ? media[slug] : undefined

  const backButton = (
    <div className="exercise-header">
      <BackButton onClick={onBack} />
    </div>
  )

  if (failed) {
    return (
      <div className="screen">
        {backButton}
        <p className="screen-subtitle">Could not load the exercise.</p>
      </div>
    )
  }

  if (!plan || !workout) {
    return (
      <div className="screen">
        {backButton}
        <p className="screen-subtitle">{plan ? 'Exercise not found in the plan.' : 'Loading exercise'}</p>
      </div>
    )
  }

  const exercise = resolveExercise(plan, workout, slug)
  const videoId = entry?.youtube ? youtubeId(entry.youtube) : null

  const reps =
    exercise.repMin === exercise.repMax
      ? String(exercise.repMin)
      : `${exercise.repMin} to ${exercise.repMax}`

  return (
    <div className="screen exercise">
      <div className="exercise-header">
        <BackButton onClick={onBack} />
        <h1 className="exercise-title">{exercise.name}</h1>
      </div>
      <div className="exercise-props">
        <div className="prop-row">
          <span className="exercise-prop-label">Sets</span>
          <span className="exercise-prop-value">{exercise.sets}</span>
        </div>
        <div className="prop-row">
          <span className="exercise-prop-label">Reps</span>
          <span className="exercise-prop-value">{reps}</span>
        </div>
        <div className="prop-row">
          <span className="exercise-prop-label">Band</span>
          <span className="exercise-prop-value">{exercise.startBand}</span>
        </div>
        <div className="prop-row">
          <span className="exercise-prop-label">Rest</span>
          <span className="exercise-prop-value">{exercise.restSeconds} s</span>
        </div>
        <div className="prop-row">
          <span className="exercise-prop-label">Equipment</span>
          <span className="exercise-prop-value">{equipmentWord(exercise.equipment)}</span>
        </div>
      </div>
      {exercise.unilateral ? <p className="exercise-note">One set per side.</p> : null}
      {exercise.optional ? <p className="exercise-note">Optional.</p> : null}

      {training && training.logs.some((l) => l.exercise_slug === slug) ? (
        <>
          <section className="exercise-section">
            <h2 className="section-head">Strength</h2>
            <StrengthChart slug={slug} data={training} />
          </section>

          <section className="exercise-section">
            <h2 className="section-head">History</h2>
            <ul className="exercise-history">
              {exerciseHistory(training.logs, training.sessions, slug, 5).map((h) => (
                <li key={h.sessionId}>
                  <span className="exercise-history-date">{h.date}</span> , {h.text}
                </li>
              ))}
            </ul>
          </section>

          <section className="exercise-section">
            <h2 className="section-head">Records</h2>
            <ul className="exercise-history">
              {recordsByBand(training.logs, training.sessions, slug, training.plan, training.inventory).map((r) => (
                <li key={r.band}>
                  <span className="exercise-history-date">{r.band}</span> , {r.reps} reps
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <section className="exercise-section">
        <h2 className="section-head">Targets</h2>
        <p>{exercise.targets}</p>
      </section>

      <section className="exercise-section">
        <h2 className="section-head">Muscles</h2>
        <MuscleMap primary={exercise.muscles.primary} secondary={exercise.muscles.secondary} />
      </section>

      <Collapsible title="Setup" defaultOpen>
        <ul className="exercise-list">
          {exercise.instructions.setup.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ul>
      </Collapsible>

      <Collapsible title="Execution">
        <ol className="exercise-list">
          {exercise.instructions.execution.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </Collapsible>

      {exercise.instructions.cues ? (
        <section className="exercise-section">
          <h2 className="section-head">Cues</h2>
          <p>{exercise.instructions.cues}</p>
        </section>
      ) : null}

      {exercise.instructions.mistakes ? (
        <section className="exercise-section">
          <h2 className="section-head">Common mistakes</h2>
          <p>{exercise.instructions.mistakes}</p>
        </section>
      ) : null}

      {exercise.instructions.progress ? (
        <section className="exercise-section">
          <h2 className="section-head">Progress</h2>
          <p>{exercise.instructions.progress}</p>
        </section>
      ) : null}

      {videoId ? (
        <section className="exercise-section">
          <h2 className="section-head">Video</h2>
          <iframe
            className="exercise-video"
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            title={`${exercise.name} video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </section>
      ) : null}

      {entry && entry.images.length > 0 ? (
        <section className="exercise-section">
          <h2 className="section-head">Pictures</h2>
          <div className="exercise-images">
            {entry.images.map((src) => (
              <img key={src} src={src} alt={`${exercise.name} picture`} className="exercise-image" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
