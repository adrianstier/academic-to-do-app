-- Migration 001: Projects, Tags, and Links
-- Academic task management: group tasks by project, apply tags, attach links
--
-- Run with: npx supabase db push or via scripts/apply-migration.mjs

-- ============================================
-- Projects table
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  icon TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  pi_id UUID,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Tags table
-- ============================================
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, name)
);

-- ============================================
-- Todo-Tag junction table
-- ============================================
CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);

-- ============================================
-- Todo links table (papers, datasets, repos)
-- ============================================
CREATE TABLE IF NOT EXISTS todo_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT,
  type TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('paper', 'dataset', 'repo', 'doc', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Add project_id and start_date to todos
-- ============================================
ALTER TABLE todos ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS start_date DATE;

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_links ENABLE ROW LEVEL SECURITY;

-- Projects: team members can read; owners/admins can write
CREATE POLICY "projects_select" ON projects FOR SELECT USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "projects_delete" ON projects FOR DELETE USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);

-- Tags: similar team scoping
CREATE POLICY "tags_select" ON tags FOR SELECT USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "tags_insert" ON tags FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "tags_delete" ON tags FOR DELETE USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);

-- Todo tags: inherit from todo access
CREATE POLICY "todo_tags_select" ON todo_tags FOR SELECT USING (
  todo_id IN (SELECT id FROM todos WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "todo_tags_insert" ON todo_tags FOR INSERT WITH CHECK (
  todo_id IN (SELECT id FROM todos WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "todo_tags_delete" ON todo_tags FOR DELETE USING (
  todo_id IN (SELECT id FROM todos WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
);

-- Todo links: inherit from todo access
CREATE POLICY "todo_links_all" ON todo_links USING (
  todo_id IN (SELECT id FROM todos WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
);

-- ============================================
-- Indexes for query performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_tags_team_id ON tags(team_id);
CREATE INDEX IF NOT EXISTS idx_todo_tags_todo_id ON todo_tags(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_todo_links_todo_id ON todo_links(todo_id);
CREATE INDEX IF NOT EXISTS idx_todos_project_id ON todos(project_id);
