import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { loadMedia, loadPlan, resolveExercise } from '../data/plan'
import type { MediaMap, PlanData } from '../data/plan'
import { MuscleMap } from '../components/MuscleMap'
import { StrengthChart } from '../components/StrengthChart'
import { useTrainingData } from '../components/useTrainingData'
import { exerciseHistory, recordsByBand } from '../lib/analytics'
import './exercise.css'

function hueFor(workoutId: string): string {
  switch (workoutId) {
    case 'pull':
      return 'var(--hue-pull)'
    case 'push':
      return 'var(--hue-push)'
    case 'shoulders-arms':
      return 'var(--hue-shoulders)'
    case 'legs-forearms':
      return 'var(--hue-legs)'
    default:
      return 'var(--color-accent)'
  }
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
    <button type="button" className="exercise-back" onClick={onBack}>
      <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
      Back
    </button>
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
    <div
      className="screen"
      style={{ ['--exercise-hue' as string]: hueFor(workout.id) }}
    >
      {backButton}
      <div className="exercise-cover">
        <svg
          className="exercise-cover-logo"
          viewBox="0 0 100 50"
          aria-hidden="true"
        >
          <path
            d="M50,25 C50,8 18,8 18,25 C18,42 50,42 50,25 C50,8 82,8 82,25 C82,42 50,42 50,25 Z"
            fill="none"
            stroke="var(--exercise-hue)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="exercise-cover-text">
          <p className="exercise-cover-day">{workout.day}</p>
          <h1 className="exercise-cover-title">{workout.name}</h1>
        </div>
      </div>
      <h1>{exercise.name}</h1>
      <div className="exercise-props">
        <div className="exercise-prop-row">
          <span className="exercise-prop-label">Sets</span>
          <span className="exercise-prop-value">{exercise.sets}</span>
        </div>
        <div className="exercise-prop-row">
          <span className="exercise-prop-label">Reps</span>
          <span className="exercise-prop-value">{reps}</span>
        </div>
        <div className="exercise-prop-row">
          <span className="exercise-prop-label">Band</span>
          <span className="exercise-prop-value">{exercise.startBand}</span>
        </div>
        <div className="exercise-prop-row">
          <span className="exercise-prop-label">Rest</span>
          <span className="exercise-prop-value">{exercise.restSeconds} s</span>
        </div>
        <div className="exercise-prop-row">
          <span className="exercise-prop-label">Equipment</span>
          <span className="exercise-prop-value">{exercise.equipment}</span>
        </div>
      </div>
      {exercise.unilateral ? <p className="exercise-note">One set per side.</p> : null}
      {exercise.optional ? <p className="exercise-note">Optional.</p> : null}

      {training && training.logs.some((l) => l.exercise_slug === slug) ? (
        <>
          <section className="exercise-section">
            <h2>Strength</h2>
            <StrengthChart slug={slug} data={training} />
          </section>

          <section className="exercise-section">
            <h2>History</h2>
            <ul className="exercise-history">
              {exerciseHistory(training.logs, training.sessions, slug, 5).map((h) => (
                <li key={h.sessionId}>
                  <span className="exercise-history-date">{h.date}</span> {'\u2014'} {h.text}
                </li>
              ))}
            </ul>
          </section>

          <section className="exercise-section">
            <h2>Records</h2>
            <ul className="exercise-history">
              {recordsByBand(training.logs, training.sessions, slug, training.plan, training.inventory).map((r) => (
                <li key={r.band}>
                  <span className="exercise-history-date">{r.band}</span> {'\u2014'} {r.reps} reps
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <section className="exercise-section">
        <h2>Targets</h2>
        <p>{exercise.targets}</p>
      </section>

      <section className="exercise-section">
        <h2>Muscles</h2>
        <MuscleMap primary={exercise.muscles.primary} secondary={exercise.muscles.secondary} />
      </section>

      <section className="exercise-section">
        <h2>Setup</h2>
        <ul className="exercise-list">
          {exercise.instructions.setup.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ul>
      </section>

      <section className="exercise-section">
        <h2>Execution</h2>
        <ol className="exercise-list">
          {exercise.instructions.execution.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>

      {exercise.instructions.cues ? (
        <section className="exercise-section">
          <h2>Cues</h2>
          <p>{exercise.instructions.cues}</p>
        </section>
      ) : null}

      {exercise.instructions.mistakes ? (
        <section className="exercise-section">
          <h2>Common mistakes</h2>
          <p>{exercise.instructions.mistakes}</p>
        </section>
      ) : null}

      {exercise.instructions.progress ? (
        <section className="exercise-section">
          <h2>Progress</h2>
          <p>{exercise.instructions.progress}</p>
        </section>
      ) : null}

      <section className="exercise-section">
        <h2>Video</h2>
        {videoId ? (
          <iframe
            className="exercise-video"
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            title={`${exercise.name} video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <p className="exercise-note">No video yet.</p>
        )}
      </section>

      <section className="exercise-section">
        <h2>Pictures</h2>
        {entry && entry.images.length > 0 ? (
          <div className="exercise-images">
            {entry.images.map((src) => (
              <img key={src} src={src} alt={`${exercise.name} picture`} className="exercise-image" />
            ))}
          </div>
        ) : (
          <p className="exercise-note">No pictures yet.</p>
        )}
      </section>
    </div>
  )
}
