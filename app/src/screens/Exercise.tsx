import { useEffect, useState } from 'react'
import { loadMedia, loadPlan, resolveExercise } from '../data/plan'
import type { MediaMap, PlanData } from '../data/plan'
import { BackButton } from '../components/BackButton'
import { MuscleMap } from '../components/MuscleMap'
import { Collapsible } from '../components/Collapsible'
import { useTrainingData } from '../components/useTrainingData'
import { recordsByBand } from '../lib/analytics'
import { lastUsed, type LastUsed } from '../lib/lastUsed'
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

function LastTime({ history }: { history: LastUsed[] }) {
  const [latest, ...earlier] = history
  return (
    <>
      <section className="exercise-last" aria-label="Last time">
        <div className="exercise-last-head">
          <h2 className="section-head">Last time</h2>
          {latest ? <span className="exercise-last-date">{latest.dayLabel}</span> : null}
        </div>
        {latest ? (
          <p className="exercise-last-sets">
            {latest.text}
            {latest.rir ? <span className="exercise-chip">{latest.rir}</span> : null}
          </p>
        ) : (
          <p className="exercise-last-empty">Not done yet.</p>
        )}
      </section>
      {earlier.length > 0 ? (
        <Collapsible id="exercise.earlier" title="Earlier sessions" summary={String(earlier.length)}>
          <ul className="exercise-history exercise-history-earlier">
            {earlier.map((h) => (
              <li key={h.sessionId}>
                <span className="exercise-history-date">{h.dayLabel}</span>
                <span className="exercise-history-sets">
                  {h.text}
                  {h.rir ? <span className="exercise-chip">{h.rir}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Collapsible>
      ) : null}
    </>
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
  const records = training ? recordsByBand(training.logs, training.sessions, slug, training.plan, training.inventory) : []
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

      {training ? <LastTime history={lastUsed(training.logs, training.sessions, slug, 6)} /> : null}

      <Collapsible id="exercise.setup" title="Setup" defaultOpen>
        <ul className="exercise-list">
          {exercise.instructions.setup.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ul>
      </Collapsible>

      <Collapsible id="exercise.execution" title="Execution">
        <ol className="exercise-list">
          {exercise.instructions.execution.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </Collapsible>

      <Collapsible id="exercise.targets" title="Targets and muscles">
        <h3 className="exercise-subhead">Targets</h3>
        <p>{exercise.targets}</p>
        <h3 className="exercise-subhead">Muscles</h3>
        <MuscleMap primary={exercise.muscles.primary} secondary={exercise.muscles.secondary} />
      </Collapsible>

      {records.length > 0 ? (
        <Collapsible id="exercise.records" title="Records" summary={`${records.length} ${records.length === 1 ? 'band' : 'bands'}`}>
          <ul className="exercise-history">
            {records.map((r) => (
              <li key={r.band}>
                <span className="exercise-history-date">{r.band}</span> , {r.reps} reps
              </li>
            ))}
          </ul>
        </Collapsible>
      ) : null}

      {exercise.instructions.cues ? (
        <Collapsible id="exercise.cues" title="Cues">
        <p>{exercise.instructions.cues}</p>
        </Collapsible>
      ) : null}

      {exercise.instructions.mistakes ? (
        <Collapsible id="exercise.mistakes" title="Common mistakes">
        <p>{exercise.instructions.mistakes}</p>
        </Collapsible>
      ) : null}

      {exercise.instructions.progress ? (
        <Collapsible id="exercise.progress" title="Progress">
        <p>{exercise.instructions.progress}</p>
        </Collapsible>
      ) : null}

      {videoId ? (
        <Collapsible id="exercise.video" title="Video">
        <iframe
          className="exercise-video"
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={`${exercise.name} video`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        </Collapsible>
      ) : null}

      {entry && entry.images.length > 0 ? (
        <Collapsible id="exercise.pictures" title="Pictures">
        <div className="exercise-images">
          {entry.images.map((src) => (
            <img key={src} src={src} alt={`${exercise.name} picture`} className="exercise-image" />
          ))}
        </div>
        </Collapsible>
      ) : null}
    </div>
  )
}
