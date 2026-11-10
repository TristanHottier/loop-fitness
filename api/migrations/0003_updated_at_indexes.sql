-- 0003_updated_at_indexes.sql: speed up the incremental pull (WHERE updated_at > ?)
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_set_logs_updated_at ON set_logs(updated_at);
CREATE INDEX IF NOT EXISTS idx_body_metrics_updated_at ON body_metrics(updated_at);
CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);
CREATE INDEX IF NOT EXISTS idx_nutrition_updated_at ON nutrition(updated_at);
