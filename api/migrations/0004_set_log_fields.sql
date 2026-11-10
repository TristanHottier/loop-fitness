-- 0004_set_log_fields.sql: reps in reserve and set type on set logs.
-- Both columns are nullable so rows pushed by older clients stay valid.
-- Pull normalises a missing set_type to 'normal'.
ALTER TABLE set_logs ADD COLUMN rir INTEGER;
ALTER TABLE set_logs ADD COLUMN set_type TEXT;
CREATE INDEX IF NOT EXISTS idx_set_logs_exercise ON set_logs(exercise_slug);
