-- 0002_nutrition.sql: daily nutrition entries (calories + protein)
CREATE TABLE IF NOT EXISTS nutrition (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein REAL NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_nutrition_date ON nutrition(date);
