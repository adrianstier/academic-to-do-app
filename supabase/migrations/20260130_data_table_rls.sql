-- ============================================
-- Team-scoped RLS policies for data tables
-- ============================================
-- Adds team isolation to all data tables that have team_id columns.
-- Allows access to legacy rows (team_id IS NULL) for backward compatibility.
-- Requires the user_team_ids() function from 20260128_agency_to_team_migration.sql.

-- Drop existing permissive policies on data tables so we can replace them
-- with team-scoped ones. Wrapped in DO blocks to handle cases where
-- policies may not exist.

DO $$ BEGIN
  -- todos
  DROP POLICY IF EXISTS "todos_select_policy" ON todos;
  DROP POLICY IF EXISTS "todos_insert_policy" ON todos;
  DROP POLICY IF EXISTS "todos_update_policy" ON todos;
  DROP POLICY IF EXISTS "todos_delete_policy" ON todos;
  DROP POLICY IF EXISTS "Allow all operations" ON todos;
  DROP POLICY IF EXISTS "todos_select" ON todos;
  DROP POLICY IF EXISTS "todos_insert" ON todos;
  DROP POLICY IF EXISTS "todos_update" ON todos;
  DROP POLICY IF EXISTS "todos_delete" ON todos;

  -- messages
  DROP POLICY IF EXISTS "messages_select_policy" ON messages;
  DROP POLICY IF EXISTS "messages_insert_policy" ON messages;
  DROP POLICY IF EXISTS "messages_update_policy" ON messages;
  DROP POLICY IF EXISTS "messages_delete_policy" ON messages;
  DROP POLICY IF EXISTS "Allow all operations" ON messages;
  DROP POLICY IF EXISTS "messages_select" ON messages;
  DROP POLICY IF EXISTS "messages_insert" ON messages;
  DROP POLICY IF EXISTS "messages_update" ON messages;
  DROP POLICY IF EXISTS "messages_delete" ON messages;

  -- activity_log
  DROP POLICY IF EXISTS "activity_log_select_policy" ON activity_log;
  DROP POLICY IF EXISTS "activity_log_insert_policy" ON activity_log;
  DROP POLICY IF EXISTS "Allow all operations" ON activity_log;
  DROP POLICY IF EXISTS "activity_log_select" ON activity_log;
  DROP POLICY IF EXISTS "activity_log_insert" ON activity_log;

  -- task_templates
  DROP POLICY IF EXISTS "task_templates_select_policy" ON task_templates;
  DROP POLICY IF EXISTS "task_templates_insert_policy" ON task_templates;
  DROP POLICY IF EXISTS "task_templates_update_policy" ON task_templates;
  DROP POLICY IF EXISTS "task_templates_delete_policy" ON task_templates;
  DROP POLICY IF EXISTS "Allow all operations" ON task_templates;
  DROP POLICY IF EXISTS "task_templates_select" ON task_templates;
  DROP POLICY IF EXISTS "task_templates_insert" ON task_templates;
  DROP POLICY IF EXISTS "task_templates_update" ON task_templates;
  DROP POLICY IF EXISTS "task_templates_delete" ON task_templates;

  -- strategic_goals
  DROP POLICY IF EXISTS "strategic_goals_select_policy" ON strategic_goals;
  DROP POLICY IF EXISTS "strategic_goals_insert_policy" ON strategic_goals;
  DROP POLICY IF EXISTS "strategic_goals_update_policy" ON strategic_goals;
  DROP POLICY IF EXISTS "strategic_goals_delete_policy" ON strategic_goals;
  DROP POLICY IF EXISTS "Allow all operations" ON strategic_goals;
  DROP POLICY IF EXISTS "strategic_goals_select" ON strategic_goals;
  DROP POLICY IF EXISTS "strategic_goals_insert" ON strategic_goals;
  DROP POLICY IF EXISTS "strategic_goals_update" ON strategic_goals;
  DROP POLICY IF EXISTS "strategic_goals_delete" ON strategic_goals;

  -- goal_categories
  DROP POLICY IF EXISTS "goal_categories_select_policy" ON goal_categories;
  DROP POLICY IF EXISTS "goal_categories_insert_policy" ON goal_categories;
  DROP POLICY IF EXISTS "goal_categories_update_policy" ON goal_categories;
  DROP POLICY IF EXISTS "Allow all operations" ON goal_categories;
  DROP POLICY IF EXISTS "goal_categories_select" ON goal_categories;
  DROP POLICY IF EXISTS "goal_categories_insert" ON goal_categories;
  DROP POLICY IF EXISTS "goal_categories_update" ON goal_categories;
END $$;

-- Ensure RLS is enabled on all data tables
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_categories ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TODOS: Team-scoped policies
-- ============================================

CREATE POLICY "todos_select_team" ON todos
  FOR SELECT USING (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

CREATE POLICY "todos_insert_team" ON todos
  FOR INSERT WITH CHECK (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

CREATE POLICY "todos_update_team" ON todos
  FOR UPDATE USING (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

CREATE POLICY "todos_delete_team" ON todos
  FOR DELETE USING (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

-- ============================================
-- MESSAGES: Team-scoped policies
-- ============================================

CREATE POLICY "messages_select_team" ON messages
  FOR SELECT USING (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

CREATE POLICY "messages_insert_team" ON messages
  FOR INSERT WITH CHECK (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

CREATE POLICY "messages_update_team" ON messages
  FOR UPDATE USING (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

CREATE POLICY "messages_delete_team" ON messages
  FOR DELETE USING (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

-- ============================================
-- ACTIVITY_LOG: Team-scoped policies (append-only for non-admins)
-- ============================================

CREATE POLICY "activity_log_select_team" ON activity_log
  FOR SELECT USING (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

CREATE POLICY "activity_log_insert_team" ON activity_log
  FOR INSERT WITH CHECK (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

-- ============================================
-- TASK_TEMPLATES: Team-scoped policies
-- ============================================

CREATE POLICY "task_templates_select_team" ON task_templates
  FOR SELECT USING (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

CREATE POLICY "task_templates_insert_team" ON task_templates
  FOR INSERT WITH CHECK (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

CREATE POLICY "task_templates_update_team" ON task_templates
  FOR UPDATE USING (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

CREATE POLICY "task_templates_delete_team" ON task_templates
  FOR DELETE USING (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

-- ============================================
-- STRATEGIC_GOALS: Team-scoped policies
-- ============================================

CREATE POLICY "strategic_goals_select_team" ON strategic_goals
  FOR SELECT USING (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

CREATE POLICY "strategic_goals_insert_team" ON strategic_goals
  FOR INSERT WITH CHECK (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

CREATE POLICY "strategic_goals_update_team" ON strategic_goals
  FOR UPDATE USING (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

CREATE POLICY "strategic_goals_delete_team" ON strategic_goals
  FOR DELETE USING (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

-- ============================================
-- GOAL_CATEGORIES: Team-scoped policies
-- ============================================

CREATE POLICY "goal_categories_select_team" ON goal_categories
  FOR SELECT USING (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

CREATE POLICY "goal_categories_insert_team" ON goal_categories
  FOR INSERT WITH CHECK (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );

CREATE POLICY "goal_categories_update_team" ON goal_categories
  FOR UPDATE USING (
    team_id IS NULL
    OR team_id IN (SELECT public.user_team_ids())
  );
