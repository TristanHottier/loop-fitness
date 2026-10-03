import { useEffect, useState } from 'react'
import {
  newNutritionEntry,
  createNutritionEntry,
  updateNutritionEntry,
  getNutritionEntries,
  getNutritionEntryByDate,
  getSetting,
  setSetting,
  type NutritionEntry,
} from '../db/db'
import { Chart, type ChartPoint } from '../components/Chart'
import { todayISODate } from '../lib/format'
import './nutrition.css'

const DEFAULT_CALORIE_GOAL = 2800
const DEFAULT_PROTEIN_GOAL = 150
const CALORIE_GOAL_KEY = 'nutrition_calorie_goal'
const PROTEIN_GOAL_KEY = 'nutrition_protein_goal'

// Read a stored goal setting, falling back to the default when the key is
// missing or the stored value is not a usable number.
function parseStoredGoal(stored: string | null, fallback: number): number {
  if (stored === null) return fallback
  const parsed = parseInt(stored, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

// Parse a goal input, falling back to the default when empty or invalid.
function parseGoalInput(raw: string, fallback: number): number {
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function Nutrition() {
  const [entries, setEntries] = useState<NutritionEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Add-entry form state.
  const [formDate, setFormDate] = useState(todayISODate())
  const [formCalories, setFormCalories] = useState('')
  const [formProtein, setFormProtein] = useState('')

  // Goals: the effective values (from settings or defaults) drive the Today
  // card, while the input strings are what the user edits in the Goals section.
  const [calorieGoal, setCalorieGoal] = useState(DEFAULT_CALORIE_GOAL)
  const [proteinGoal, setProteinGoal] = useState(DEFAULT_PROTEIN_GOAL)
  const [calorieGoalInput, setCalorieGoalInput] = useState(String(DEFAULT_CALORIE_GOAL))
  const [proteinGoalInput, setProteinGoalInput] = useState(String(DEFAULT_PROTEIN_GOAL))

  function applyData(
    all: NutritionEntry[],
    calorieSetting: string | null,
    proteinSetting: string | null
  ) {
    const calorieValue = parseStoredGoal(calorieSetting, DEFAULT_CALORIE_GOAL)
    const proteinValue = parseStoredGoal(proteinSetting, DEFAULT_PROTEIN_GOAL)
    setEntries(all)
    setCalorieGoal(calorieValue)
    setProteinGoal(proteinValue)
    setCalorieGoalInput(String(calorieValue))
    setProteinGoalInput(String(proteinValue))
  }

  async function refresh() {
    const [all, calorieSetting, proteinSetting] = await Promise.all([
      getNutritionEntries(),
      getSetting(CALORIE_GOAL_KEY),
      getSetting(PROTEIN_GOAL_KEY),
    ])
    applyData(all, calorieSetting, proteinSetting)
  }

  useEffect(() => {
    let cancelled = false
    async function init() {
      const [all, calorieSetting, proteinSetting] = await Promise.all([
        getNutritionEntries(),
        getSetting(CALORIE_GOAL_KEY),
        getSetting(PROTEIN_GOAL_KEY),
      ])
      if (cancelled) return
      applyData(all, calorieSetting, proteinSetting)
      setLoading(false)
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  const today = todayISODate()
  const todayEntry = entries.find((e) => e.date === today)
  const todayCalories = todayEntry?.calories ?? 0
  const todayProtein = todayEntry?.protein ?? 0

  const caloriePoints: ChartPoint[] = entries.map((e) => ({ date: e.date, value: e.calories }))
  const proteinPoints: ChartPoint[] = entries.map((e) => ({ date: e.date, value: e.protein }))

  async function addEntry() {
    if (!formDate) return
    const calories = formCalories === '' ? 0 : parseFloat(formCalories)
    const protein = formProtein === '' ? 0 : parseFloat(formProtein)
    if (!Number.isFinite(calories) || !Number.isFinite(protein)) return

    // Upsert on date: update the existing entry for that date, otherwise create.
    const existing = await getNutritionEntryByDate(formDate)
    if (existing) {
      existing.calories = calories
      existing.protein = protein
      await updateNutritionEntry(existing)
    } else {
      const entry = newNutritionEntry(formDate, calories, protein)
      await createNutritionEntry(entry)
    }
    setFormCalories('')
    setFormProtein('')
    await refresh()
  }

  async function saveGoals() {
    const calorieValue = parseGoalInput(calorieGoalInput, DEFAULT_CALORIE_GOAL)
    const proteinValue = parseGoalInput(proteinGoalInput, DEFAULT_PROTEIN_GOAL)

    const [storedCalories, storedProtein] = await Promise.all([
      getSetting(CALORIE_GOAL_KEY),
      getSetting(PROTEIN_GOAL_KEY),
    ])

    // Only write a key when it changed from its stored value. When nothing is
    // stored yet, the input (prefilled with the default) establishes the baseline.
    if (storedCalories === null || String(calorieValue) !== storedCalories) {
      await setSetting(CALORIE_GOAL_KEY, String(calorieValue))
    }
    if (storedProtein === null || String(proteinValue) !== storedProtein) {
      await setSetting(PROTEIN_GOAL_KEY, String(proteinValue))
    }

    await refresh()
  }

  if (loading) {
    return (
      <div className="screen">
        <h1>Nutrition</h1>
        <p className="screen-subtitle">Loading</p>
      </div>
    )
  }

  return (
    <div className="screen nutrition">
      <h1>Nutrition</h1>
      <p className="screen-subtitle">Daily calories and protein.</p>

      <section className="nutrition-goal-card">
        <h2 className="nutrition-card-title">Today</h2>
        <div className="nutrition-goal-row">
          <span className="nutrition-goal-label">Calories</span>
          <div className="nutrition-goal-meta">
            <span className="nutrition-goal-value">
              {todayCalories} / {calorieGoal} kcal
            </span>
            {todayCalories >= calorieGoal ? (
              <span className="nutrition-goal-reached">Goal reached</span>
            ) : (
              <span className="nutrition-goal-remaining">
                {calorieGoal - todayCalories} to go
              </span>
            )}
          </div>
        </div>
        <div className="nutrition-goal-row">
          <span className="nutrition-goal-label">Protein</span>
          <div className="nutrition-goal-meta">
            <span className="nutrition-goal-value">
              {todayProtein} / {proteinGoal} g
            </span>
            {todayProtein >= proteinGoal ? (
              <span className="nutrition-goal-reached">Goal reached</span>
            ) : (
              <span className="nutrition-goal-remaining">
                {proteinGoal - todayProtein} to go
              </span>
            )}
          </div>
        </div>
      </section>

      <Chart title="Calories" points={caloriePoints} unit="kcal" showAverage />
      <Chart title="Protein" points={proteinPoints} unit="g" />

      <section className="nutrition-section">
        <h2 className="nutrition-section-title">Entries</h2>
        <form
          className="nutrition-form"
          onSubmit={(e) => {
            e.preventDefault()
            void addEntry()
          }}
        >
          <div className="nutrition-form-row">
            <input
              className="nutrition-input nutrition-input-date"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
            />
            <input
              className="nutrition-input nutrition-input-number"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="Calories"
              value={formCalories}
              onChange={(e) => setFormCalories(e.target.value)}
            />
            <input
              className="nutrition-input nutrition-input-number"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="Protein"
              value={formProtein}
              onChange={(e) => setFormProtein(e.target.value)}
            />
          </div>
          <button type="submit" className="nutrition-add">
            Add entry
          </button>
        </form>
      </section>

      <section className="nutrition-section">
        <h2 className="nutrition-section-title">Goals</h2>
        <form
          className="nutrition-form"
          onSubmit={(e) => {
            e.preventDefault()
            void saveGoals()
          }}
        >
          <div className="nutrition-form-row">
            <label className="nutrition-goal-field">
              <span className="nutrition-goal-field-label">Calorie goal</span>
              <input
                className="nutrition-input nutrition-input-number"
                type="number"
                inputMode="numeric"
                min="0"
                value={calorieGoalInput}
                onChange={(e) => setCalorieGoalInput(e.target.value)}
              />
            </label>
            <label className="nutrition-goal-field">
              <span className="nutrition-goal-field-label">Protein goal</span>
              <input
                className="nutrition-input nutrition-input-number"
                type="number"
                inputMode="numeric"
                min="0"
                value={proteinGoalInput}
                onChange={(e) => setProteinGoalInput(e.target.value)}
              />
            </label>
          </div>
          <button type="submit" className="nutrition-add">
            Save goals
          </button>
        </form>
      </section>
    </div>
  )
}
