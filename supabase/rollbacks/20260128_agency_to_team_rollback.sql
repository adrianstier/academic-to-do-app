-- Rollback Migration: Agency to Team Terminology Migration
-- Date: 2026-01-28
-- Description: Rollback the team_* tables if needed
-- WARNING: This will DELETE all data in team_* tables - use with caution!

-- ============================================
-- STEP 1: DROP SYNC TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS sync_todos_agency_team ON todos;
DROP TRIGGER IF EXISTS sync_messages_agency_team ON messages;
DROP TRIGGER IF EXISTS sync_activity_log_agency_team ON activity_log;
DROP TRIGGER IF EXISTS sync_task_templates_agency_team ON task_templates;
DROP TRIGGER IF EXISTS sync_strategic_goals_agency_team ON strategic_goals;
DROP TRIGGER IF EXISTS sync_goal_categories_agency_team ON goal_categories;

DROP FUNCTION IF EXISTS sync_agency_team_id();

-- ============================================
-- STEP 2: DROP TEAM RLS POLICIES
-- ============================================

DROP POLICY IF EXISTS "teams_select_member" ON teams;
DROP POLICY IF EXISTS "teams_insert_authenticated" ON teams;
DROP POLICY IF EXISTS "teams_update_owner" ON teams;
DROP POLICY IF EXISTS "teams_delete_owner" ON teams;

DROP POLICY IF EXISTS "team_members_select" ON team_members;
DROP POLICY IF EXISTS "team_members_insert_admin" ON team_members;
DROP POLICY IF EXISTS "team_members_update_admin" ON team_members;
DROP POLICY IF EXISTS "team_members_delete_admin" ON team_members;

DROP POLICY IF EXISTS "team_invitations_select_admin" ON team_invitations;
DROP POLICY IF EXISTS "team_invitations_insert_admin" ON team_invitations;
DROP POLICY IF EXISTS "team_invitations_delete_admin" ON team_invitations;

-- ============================================
-- STEP 3: DROP AUDIT TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS audit_teams_trigger ON teams;
DROP TRIGGER IF EXISTS audit_team_members_trigger ON team_members;
DROP TRIGGER IF EXISTS audit_team_invitations_trigger ON team_invitations;

-- ============================================
-- STEP 4: DROP UPDATED_AT TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS teams_updated_at ON teams;
DROP TRIGGER IF EXISTS team_members_updated_at ON team_members;

-- ============================================
-- STEP 5: REMOVE FROM REAL-TIME PUBLICATION
-- ============================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE teams;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE team_members;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- ============================================
-- STEP 6: DROP TEAM HELPER FUNCTIONS
-- ============================================

DROP FUNCTION IF EXISTS public.current_team_id();
DROP FUNCTION IF EXISTS public.is_team_member(UUID);
DROP FUNCTION IF EXISTS public.is_team_owner(UUID);
DROP FUNCTION IF EXISTS public.is_team_admin(UUID);
DROP FUNCTION IF EXISTS public.team_role(UUID);
DROP FUNCTION IF EXISTS public.user_team_ids();
DROP FUNCTION IF EXISTS create_team_with_owner(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS accept_team_invitation(TEXT, UUID);
DROP FUNCTION IF EXISTS migrate_agencies_to_teams();

-- ============================================
-- STEP 7: DROP TEAM_ID COLUMNS FROM DATA TABLES
-- ============================================

ALTER TABLE todos DROP COLUMN IF EXISTS team_id;
ALTER TABLE messages DROP COLUMN IF EXISTS team_id;
ALTER TABLE activity_log DROP COLUMN IF EXISTS team_id;
ALTER TABLE task_templates DROP COLUMN IF EXISTS team_id;
ALTER TABLE strategic_goals DROP COLUMN IF EXISTS team_id;
ALTER TABLE goal_categories DROP COLUMN IF EXISTS team_id;

-- ============================================
-- STEP 8: DROP TEAM TABLES
-- ============================================

DROP TABLE IF EXISTS team_invitations;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;

-- ============================================
-- STEP 9: RESTORE ORIGINAL SET_REQUEST_CONTEXT FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION set_request_context(
  p_user_id UUID,
  p_user_name TEXT,
  p_agency_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.user_id', COALESCE(p_user_id::text, ''), false);
  PERFORM set_config('app.user_name', COALESCE(p_user_name, ''), false);
  IF p_agency_id IS NOT NULL THEN
    PERFORM set_config('app.agency_id', p_agency_id::text, false);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DONE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Rollback complete. Team tables and columns have been removed.';
  RAISE NOTICE 'Agency tables and columns remain intact.';
END $$;
