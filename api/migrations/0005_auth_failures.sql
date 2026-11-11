-- Failed-authentication counters for rate limiting (see api/src/index.ts,
-- requireAuth). One row per bucket (currently "ip:<client ip>"), fixed window.
CREATE TABLE IF NOT EXISTS auth_failures (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start TEXT NOT NULL
);
