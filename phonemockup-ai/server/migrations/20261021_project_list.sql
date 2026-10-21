-- Apply after 20261017_clerk_identity.sql, outside a transaction block:
-- CREATE INDEX CONCURRENTLY can't run inside one.

-- The project list's cursor goes through a JS Date, which holds milliseconds.
-- At microsecond precision, projects saved later in the same millisecond were
-- skipped when paging. Existing values are rounded to the millisecond.
ALTER TABLE project
    ALTER COLUMN created_at TYPE timestamptz(3),
    ALTER COLUMN updated_at TYPE timestamptz(3);

-- Listing a user's projects and a project's files scanned the whole table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS project_owner_created_idx
    ON project (owner, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS file_project_idx
    ON file (project_id);
