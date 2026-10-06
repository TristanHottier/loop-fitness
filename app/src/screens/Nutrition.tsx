import { useEffect, useState } from 'react'
import {
  newNutritionEntry,
  createNutritionEntry,
  getNutritionEntries,
  getSetting,
  setSetting,
  type NutritionEntry,
} from '../db/db'
import { Chart, type ChartPoint } from '../components/Chart'
import { todayISODate } from '../lib/format'
import './nutrition.css'

const DEFAULT_CALORIE_GOAL_MIN = 2400
const DEFAULT_CALORIE_GOAL_MAX = 3000
const DEFAULT_PROTEIN_GOAL_MIN = 120
const DEFAULT_PROTEIN_GOAL_MAX = 180
const CALORIE_GOAL_KEY = 'nutrition_calorie_goal'
const PROTEIN_GOAL_KEY = 'nutrition_protein_goal'

interface GoalInterval {
  min: number
  max: number
}

// Parse a stored goal setting into a min/max interval. The stored value is a
// single string: "min max" for the interval format, or a lone number for the
// old single-value format (treated as min = max). Missing or invalid values
// fall back to the defaults.
function parseStoredGoal(
  stored: string | null,
  fallbackMin: number,
  fallbackMax: number
): GoalInterval {
  if (stored === null) return { min: fallbackMin, max: fallbackMax }
  const parts = stored.trim().split(/\s+/).filter((p) => p !== '')
  const nums = parts.map((p) => Number(p)).filter((n) => Number.isFinite(n))
  if (nums.length >= 2) {
    return { min: nums[0], max: nums[1] }
  }
  if (nums.length === 1) {
    return { min: nums[0], max: nums[0] }
  }
  return { min: fallbackMin, max: fallbackMax }
}

// Parse a goal input (min or max), falling back to the default when empty or
// invalid.
function parseGoalInput(raw: string, fallback: number): number {
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

// The status line under a goal value, relative to the min/max interval.
function goalStatus(total: number, min: number, max: number) {
  if (total < min) {
    return <span className="nutrition-goal-remaining">{min - total} to go</span>
  }
  if (total > max) {
    return <span className="nutrition-goal-remaining">{total - max} over</span>
  }
  return <span className="nutrition-goal-reached">In range</span>
}

export function Nutrition() {
  const [entries, setEntries] = useState<NutritionEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Add-entry form state.
  const [formDate, setFormDate] = useState(todayISODate())
  const [formCalories, setFormCalories] = useState('')
  const [formProtein, setFormProtein] = useState('')

  // Goals: the effective intervals (from settings or defaults) drive the
  // Today card, while the input strings are what the user edits in the Goals
  // section.
  const [calorieGoal, setCalorieGoal] = useState<GoalInterval>({
    min: DEFAULT_CALORIE_GOAL_MIN,
    max: DEFAULT_CALORIE_GOAL_MAX,
  })
  const [proteinGoal, setProteinGoal] = useState<GoalInterval>({
    min: DEFAULT_PROTEIN_GOAL_MIN,
    max: DEFAULT_PROTEIN_GOAL_MAX,
  })
  const [calorieGoalMinInput, setCalorieGoalMinInput] = useState(String(DEFAULT_CALORIE_GOAL_MIN))
  const [calorieGoalMaxInput, setCalorieGoalMaxInput] = useState(String(DEFAULT_CALORIE_GOAL_MAX))
  const [proteinGoalMinInput, setProteinGoalMinInput] = useState(String(DEFAULT_PROTEIN_GOAL_MIN))
  const [proteinGoalMaxInput, setProteinGoalMaxInput] = useState(String(DEFAULT_PROTEIN_GOAL_MAX))

  function applyData(
    all: NutritionEntry[],
    calorieSetting: string | null,
    proteinSetting: string | null
  ) {
    const calorieValue = parseStoredGoal(
      calorieSetting,
      DEFAULT_CALORIE_GOAL_MIN,
      DEFAULT_CALORIE_GOAL_MAX
    )
    const proteinValue = parseStoredGoal(
      proteinSetting,
      DEFAULT_PROTEIN_GOAL_MIN,
      DEFAULT_PROTEIN_GOAL_MAX
    )
    setEntries(all)
    setCalorieGoal(calorieValue)
    setProteinGoal(proteinValue)
    setCalorieGoalMinInput(String(calorieValue.min))
    setCalorieGoalMaxInput(String(calorieValue.max))
    setProteinGoalMinInput(String(proteinValue.min))
    setProteinGoalMaxInput(String(proteinValue.max))
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
  const todayCalories = entries
    .filter((e) => e.date === today)
    .reduce((sum, e) => sum + e.calories, 0)
  const todayProtein = entries
    .filter((e) => e.date === today)
    .reduce((sum, e) => sum + e.protein, 0)

  // Group entries by date and sum each metric, so the charts show one point
  // per day (the daily total) instead of one point per meal.
  function dailyTotals(key: 'calories' | 'protein'): ChartPoint[] {
    const byDate = new Map<string, number>()
    for (const e of entries) {
      byDate.set(e.date, (byDate.get(e.date) ?? 0) + e[key])
    }
    return [...byDate.entries()]
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  const caloriePoints = dailyTotals('calories')
  const proteinPoints = dailyTotals('protein')

  async function addEntry() {
    if (!formDate) return
    const calories = formCalories === '' ? 0 : parseFloat(formCalories)
    const protein = formProtein === '' ? 0 : parseFloat(formProtein)
    if (!Number.isFinite(calories) || !Number.isFinite(protein)) return

    // Each submit creates a new entry (one per meal). Entries for the same
    // day add up in the Today card and the daily chart totals.
    const entry = newNutritionEntry(formDate, calories, protein)
    await createNutritionEntry(entry)
    // Clear the meal values but keep the date so several meals for the same
    // day can be logged in a row.
    setFormCalories('')
    setFormProtein('')
    await refresh()
  }

  async function saveGoals() {
    const calorieMin = parseGoalInput(calorieGoalMinInput, DEFAULT_CALORIE_GOAL_MIN)
    const calorieMax = parseGoalInput(calorieGoalMaxInput, DEFAULT_CALORIE_GOAL_MAX)
    const proteinMin = parseGoalInput(proteinGoalMinInput, DEFAULT_PROTEIN_GOAL_MIN)
    const proteinMax = parseGoalInput(proteinGoalMaxInput, DEFAULT_PROTEIN_GOAL_MAX)

    const [storedCalories, storedProtein] = await Promise.all([
      getSetting(CALORIE_GOAL_KEY),
      getSetting(PROTEIN_GOAL_KEY),
    ])

    // Each goal is stored as a single "min max" string.
    const calorieValue = `${calorieMin} ${calorieMax}`
    const proteinValue = `${proteinMin} ${proteinMax}`

    // Only write a key when it changed from its stored value. When nothing is
    // stored yet, the inputs (prefilled with the defaults) establish the
    // baseline.
    if (storedCalories === null || calorieValue !== storedCalories) {
      await setSetting(CALORIE_GOAL_KEY, calorieValue)
    }
    if (storedProtein === null || proteinValue !== storedProtein) {
      await setSetting(PROTEIN_GOAL_KEY, proteinValue)
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

      <section className="nutrition-goal-card">
        <h2 className="nutrition-card-title">Today</h2>
        <div className="nutrition-goal-row">
          <span className="nutrition-goal-label">Calories</span>
          <div className="nutrition-goal-meta">
            <span className="nutrition-goal-value">
              {todayCalories} / {calorieGoal.min}-{calorieGoal.max} kcal
            </span>
            {goalStatus(todayCalories, calorieGoal.min, calorieGoal.max)}
          </div>
        </div>
        <div className="nutrition-goal-row">
          <span className="nutrition-goal-label">Protein</span>
          <div className="nutrition-goal-meta">
            <span className="nutrition-goal-value">
              {todayProtein} / {proteinGoal.min}-{proteinGoal.max} g
            </span>
            {goalStatus(todayProtein, proteinGoal.min, proteinGoal.max)}
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
          <div className="nutrition-goal-grid">
            <label className="nutrition-goal-field">
              <span className="nutrition-goal-field-label">Calorie goal (min)</span>
              <input
                className="nutrition-input nutrition-input-number"
                type="number"
                inputMode="numeric"
                min="0"
                value={calorieGoalMinInput}
                onChange={(e) => setCalorieGoalMinInput(e.target.value)}
              />
            </label>
            <label className="nutrition-goal-field">
              <span className="nutrition-goal-field-label">Calorie goal (max)</span>
              <input
                className="nutrition-input nutrition-input-number"
                type="number"
                inputMode="numeric"
                min="0"
                value={calorieGoalMaxInput}
                onChange={(e) => setCalorieGoalMaxInput(e.target.value)}
              />
            </label>
            <label className="nutrition-goal-field">
              <span className="nutrition-goal-field-label">Protein goal (min)</span>
              <input
                className="nutrition-input nutrition-input-number"
                type="number"
                inputMode="numeric"
                min="0"
                value={proteinGoalMinInput}
                onChange={(e) => setProteinGoalMinInput(e.target.value)}
              />
            </label>
            <label className="nutrition-goal-field">
              <span className="nutrition-goal-field-label">Protein goal (max)</span>
              <input
                className="nutrition-input nutrition-input-number"
                type="number"
                inputMode="numeric"
                min="0"
                value={proteinGoalMaxInput}
                onChange={(e) => setProteinGoalMaxInput(e.target.value)}
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
