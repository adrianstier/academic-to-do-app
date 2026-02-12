-- Migration 002: Task Dependencies
-- Adds a many-to-many relationship table for todo dependencies
-- A "blocker" must be completed before the "blocked" task can proceed

CREATE TABLE IF NOT EXISTS todo_dependencies (
  blocker_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

ALTER TABLE todo_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS: Users can manage dependencies for todos in their team
CREATE POLICY "todo_dependencies_select" ON todo_dependencies FOR SELECT USING (
  blocker_id IN (SELECT id FROM todos WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "todo_dependencies_insert" ON todo_dependencies FOR INSERT WITH CHECK (
  blocker_id IN (SELECT id FROM todos WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
  AND blocked_id IN (SELECT id FROM todos WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "todo_dependencies_delete" ON todo_dependencies FOR DELETE USING (
  blocker_id IN (SELECT id FROM todos WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
);

CREATE INDEX IF NOT EXISTS idx_todo_deps_blocker ON todo_dependencies(blocker_id);
CREATE INDEX IF NOT EXISTS idx_todo_deps_blocked ON todo_dependencies(blocked_id);
