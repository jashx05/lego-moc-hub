-- Apply exactly once to the existing Turso lego-moc-hub database before deploying V13.
-- Existing projects become public as requested by the owner.
ALTER TABLE projects ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1 CHECK(is_public IN (0,1));
CREATE INDEX IF NOT EXISTS idx_projects_public_updated ON projects(is_public,updated_at DESC);
