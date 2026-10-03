import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { loadMedia, loadPlan, resolveExercise } from '../data/plan'
import type { Exercise, MediaMap, PlanData } from '../data/plan'
import { MuscleMap } from '../components/MuscleMap'
import './exercise.css'

function specLine(exercise: Exercise): string {
  const reps =
    exercise.repMin === exercise.repMax
      ? String(exercise.repMin)
      : `${exercise.repMin}-${exercise.repMax}`
  return `${exercise.sets} x ${reps}, ${exercise.equipment}, start ${exercise.startBand}, ${exercise.restSeconds} s rest`
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

  return (
    <div className="screen">
      {backButton}
      <h1>{exercise.name}</h1>
      <p className="screen-subtitle">{specLine(exercise)}</p>
      {exercise.unilateral ? <p className="exercise-note">One set per side.</p> : null}
      {exercise.optional ? <p className="exercise-note">Optional.</p> : null}

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
