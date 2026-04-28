PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

-- The authoritative Phase 1a schema is duplicated in `src/core/storage/sql/phase1a-schema.ts`
-- so the demo runner can apply it without requiring a file-copy step during build.
