-- Migration: Agency to Team Terminology Migration
-- Date: 2026-01-28
-- Description: Add team_* tables alongside agency_* tables for terminology migration
-- Strategy: Staged migration with sync triggers for backward compatibility

-- ============================================
-- STEP 1: CREATE TEAMS TABLE (mirrors agencies)
-- ============================================

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#4F46E5',  -- Indigo default for academic
  secondary_color TEXT DEFAULT '#818CF8',
  subscription_tier TEXT DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')),
  max_users INTEGER DEFAULT 10,
  max_storage_mb INTEGER DEFAULT 1024,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for teams
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);
CREATE INDEX IF NOT EXISTS idx_teams_is_active ON teams(is_active);

-- Enable RLS on teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE teams IS 'Multi-tenant teams - equivalent to agencies with new terminology';

-- ============================================
-- STEP 2: CREATE TEAM_MEMBERS TABLE (mirrors agency_members)
-- ============================================

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  permissions JSONB DEFAULT '{
    "can_create_tasks": true,
    "can_delete_tasks": false,
    "can_view_strategic_goals": false,
    "can_invite_users": false,
    "can_manage_templates": false
  }'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  is_default_team BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, user_id)
);

-- Create indexes for team_members
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);

-- Enable RLS on team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE team_members IS 'Junction table linking users to teams with roles and permissions';

-- ============================================
-- STEP 3: CREATE TEAM_INVITATIONS TABLE (mirrors agency_invitations)
-- ============================================

CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  token TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for team_invitations
CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_expires ON team_invitations(expires_at);

-- Enable RLS on team_invitations
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE team_invitations IS 'Pending invitations for users to join a team';

-- ============================================
-- STEP 4: ADD TEAM_ID COLUMNS TO EXISTING TABLES
-- (Keep agency_id for backward compatibility)
-- ============================================

-- Add team_id to todos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'todos' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE todos ADD COLUMN team_id UUID REFERENCES teams(id);
    CREATE INDEX IF NOT EXISTS idx_todos_team ON todos(team_id);
  END IF;
END $$;

-- Add team_id to messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN team_id UUID REFERENCES teams(id);
    CREATE INDEX IF NOT EXISTS idx_messages_team ON messages(team_id);
  END IF;
END $$;

-- Add team_id to activity_log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_log' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE activity_log ADD COLUMN team_id UUID REFERENCES teams(id);
    CREATE INDEX IF NOT EXISTS idx_activity_log_team ON activity_log(team_id);
  END IF;
END $$;

-- Add team_id to task_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_templates' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE task_templates ADD COLUMN team_id UUID REFERENCES teams(id);
    CREATE INDEX IF NOT EXISTS idx_task_templates_team ON task_templates(team_id);
  END IF;
END $$;

-- Add team_id to strategic_goals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'strategic_goals' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE strategic_goals ADD COLUMN team_id UUID REFERENCES teams(id);
    CREATE INDEX IF NOT EXISTS idx_strategic_goals_team ON strategic_goals(team_id);
  END IF;
END $$;

-- Add team_id to goal_categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goal_categories' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE goal_categories ADD COLUMN team_id UUID REFERENCES teams(id);
    CREATE INDEX IF NOT EXISTS idx_goal_categories_team ON goal_categories(team_id);
  END IF;
END $$;

-- ============================================
-- STEP 5: CREATE SYNC TRIGGERS (agency_id <-> team_id)
-- These keep both columns in sync during transition
-- ============================================

-- Function to sync agency_id and team_id on data tables
CREATE OR REPLACE FUNCTION sync_agency_team_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If team_id is set but agency_id is not, copy team_id to agency_id
  IF NEW.team_id IS NOT NULL AND NEW.agency_id IS NULL THEN
    NEW.agency_id := NEW.team_id;
  -- If agency_id is set but team_id is not, copy agency_id to team_id
  ELSIF NEW.agency_id IS NOT NULL AND NEW.team_id IS NULL THEN
    NEW.team_id := NEW.agency_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sync triggers on data tables
DROP TRIGGER IF EXISTS sync_todos_agency_team ON todos;
CREATE TRIGGER sync_todos_agency_team
  BEFORE INSERT OR UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION sync_agency_team_id();

DROP TRIGGER IF EXISTS sync_messages_agency_team ON messages;
CREATE TRIGGER sync_messages_agency_team
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION sync_agency_team_id();

DROP TRIGGER IF EXISTS sync_activity_log_agency_team ON activity_log;
CREATE TRIGGER sync_activity_log_agency_team
  BEFORE INSERT OR UPDATE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION sync_agency_team_id();

DROP TRIGGER IF EXISTS sync_task_templates_agency_team ON task_templates;
CREATE TRIGGER sync_task_templates_agency_team
  BEFORE INSERT OR UPDATE ON task_templates
  FOR EACH ROW EXECUTE FUNCTION sync_agency_team_id();

DROP TRIGGER IF EXISTS sync_strategic_goals_agency_team ON strategic_goals;
CREATE TRIGGER sync_strategic_goals_agency_team
  BEFORE INSERT OR UPDATE ON strategic_goals
  FOR EACH ROW EXECUTE FUNCTION sync_agency_team_id();

DROP TRIGGER IF EXISTS sync_goal_categories_agency_team ON goal_categories;
CREATE TRIGGER sync_goal_categories_agency_team
  BEFORE INSERT OR UPDATE ON goal_categories
  FOR EACH ROW EXECUTE FUNCTION sync_agency_team_id();

-- ============================================
-- STEP 6: CREATE TEAM HELPER FUNCTIONS
-- Mirror the agency functions with team terminology
-- ============================================

-- Function to get current team from session context
CREATE OR REPLACE FUNCTION public.current_team_id()
RETURNS UUID AS $$
BEGIN
  -- Try team context first, fall back to agency context
  RETURN COALESCE(
    NULLIF(current_setting('app.team_id', true), '')::UUID,
    NULLIF(current_setting('app.agency_id', true), '')::UUID
  );
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if user is member of team
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
      AND user_id = public.get_current_user_id()
      AND status = 'active'
  ) OR EXISTS (
    -- Fall back to agency_members for backward compatibility
    SELECT 1 FROM agency_members
    WHERE agency_id = p_team_id
      AND user_id = public.get_current_user_id()
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to check if user is team owner
CREATE OR REPLACE FUNCTION public.is_team_owner(p_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
      AND user_id = public.get_current_user_id()
      AND role = 'owner'
      AND status = 'active'
  ) OR EXISTS (
    -- Fall back to agency_members for backward compatibility
    SELECT 1 FROM agency_members
    WHERE agency_id = p_team_id
      AND user_id = public.get_current_user_id()
      AND role = 'owner'
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to check if user is team admin (owner or admin)
CREATE OR REPLACE FUNCTION public.is_team_admin(p_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
      AND user_id = public.get_current_user_id()
      AND role IN ('owner', 'admin')
      AND status = 'active'
  ) OR EXISTS (
    -- Fall back to agency_members for backward compatibility
    SELECT 1 FROM agency_members
    WHERE agency_id = p_team_id
      AND user_id = public.get_current_user_id()
      AND role IN ('owner', 'admin')
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get user's role in a team
CREATE OR REPLACE FUNCTION public.team_role(p_team_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Try team_members first
  SELECT role INTO v_role
  FROM team_members
  WHERE team_id = p_team_id
    AND user_id = public.get_current_user_id()
    AND status = 'active';

  -- Fall back to agency_members
  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM agency_members
    WHERE agency_id = p_team_id
      AND user_id = public.get_current_user_id()
      AND status = 'active';
  END IF;

  RETURN v_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get all teams user belongs to
CREATE OR REPLACE FUNCTION public.user_team_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT team_id FROM team_members
  WHERE user_id = public.get_current_user_id()
    AND status = 'active'
  UNION
  SELECT agency_id FROM agency_members
  WHERE user_id = public.get_current_user_id()
    AND status = 'active';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to set session context (updated to support both team and agency)
CREATE OR REPLACE FUNCTION set_request_context(
  p_user_id UUID,
  p_user_name TEXT,
  p_agency_id UUID DEFAULT NULL,
  p_team_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.user_id', COALESCE(p_user_id::text, ''), false);
  PERFORM set_config('app.user_name', COALESCE(p_user_name, ''), false);
  IF p_agency_id IS NOT NULL THEN
    PERFORM set_config('app.agency_id', p_agency_id::text, false);
  END IF;
  IF p_team_id IS NOT NULL THEN
    PERFORM set_config('app.team_id', p_team_id::text, false);
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.current_team_id() IS 'Get team_id from session context (supports both team and agency)';
COMMENT ON FUNCTION public.is_team_member(UUID) IS 'Check if current user is active member of specified team';
COMMENT ON FUNCTION public.is_team_owner(UUID) IS 'Check if current user is owner of specified team';
COMMENT ON FUNCTION public.is_team_admin(UUID) IS 'Check if current user is owner or admin of specified team';

-- ============================================
-- STEP 7: CREATE TEAM RLS POLICIES
-- ============================================

-- Teams: Members can see their teams
CREATE POLICY "teams_select_member"
  ON teams FOR SELECT
  USING (
    id IN (SELECT public.user_team_ids()) OR
    (SELECT global_role FROM users WHERE id = public.get_current_user_id()) = 'super_admin'
  );

CREATE POLICY "teams_insert_authenticated"
  ON teams FOR INSERT
  WITH CHECK (true);  -- Anyone can create a team (they become owner)

CREATE POLICY "teams_update_owner"
  ON teams FOR UPDATE
  USING (public.is_team_owner(id));

CREATE POLICY "teams_delete_owner"
  ON teams FOR DELETE
  USING (public.is_team_owner(id));

-- Team Members: Can see members of teams they belong to
CREATE POLICY "team_members_select"
  ON team_members FOR SELECT
  USING (team_id IN (SELECT public.user_team_ids()));

CREATE POLICY "team_members_insert_admin"
  ON team_members FOR INSERT
  WITH CHECK (public.is_team_admin(team_id));

CREATE POLICY "team_members_update_admin"
  ON team_members FOR UPDATE
  USING (public.is_team_admin(team_id));

CREATE POLICY "team_members_delete_admin"
  ON team_members FOR DELETE
  USING (public.is_team_admin(team_id));

-- Team Invitations: Admins can manage invitations
CREATE POLICY "team_invitations_select_admin"
  ON team_invitations FOR SELECT
  USING (public.is_team_admin(team_id));

CREATE POLICY "team_invitations_insert_admin"
  ON team_invitations FOR INSERT
  WITH CHECK (public.is_team_admin(team_id));

CREATE POLICY "team_invitations_delete_admin"
  ON team_invitations FOR DELETE
  USING (public.is_team_admin(team_id));

-- ============================================
-- STEP 8: ADD TRIGGERS FOR UPDATED_AT
-- ============================================

-- Trigger for teams
DROP TRIGGER IF EXISTS teams_updated_at ON teams;
CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for team_members
DROP TRIGGER IF EXISTS team_members_updated_at ON team_members;
CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 9: ADD AUDIT TRIGGERS TO NEW TABLES
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger_func') THEN
    DROP TRIGGER IF EXISTS audit_teams_trigger ON teams;
    CREATE TRIGGER audit_teams_trigger
      AFTER INSERT OR UPDATE OR DELETE ON teams
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

    DROP TRIGGER IF EXISTS audit_team_members_trigger ON team_members;
    CREATE TRIGGER audit_team_members_trigger
      AFTER INSERT OR UPDATE OR DELETE ON team_members
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

    DROP TRIGGER IF EXISTS audit_team_invitations_trigger ON team_invitations;
    CREATE TRIGGER audit_team_invitations_trigger
      AFTER INSERT OR UPDATE OR DELETE ON team_invitations
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
  END IF;
END $$;

-- ============================================
-- STEP 10: ENABLE REAL-TIME FOR NEW TABLES
-- ============================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE teams;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE team_members;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================
-- STEP 11: CREATE TEAM HELPER FUNCTIONS
-- ============================================

-- Function to create a team with the creator as owner
CREATE OR REPLACE FUNCTION create_team_with_owner(
  p_name TEXT,
  p_slug TEXT,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_team_id UUID;
BEGIN
  -- Create the team
  INSERT INTO teams (name, slug)
  VALUES (p_name, p_slug)
  RETURNING id INTO v_team_id;

  -- Add creator as owner
  INSERT INTO team_members (team_id, user_id, role, is_default_team, permissions)
  VALUES (
    v_team_id,
    p_user_id,
    'owner',
    true,
    '{
      "can_create_tasks": true,
      "can_delete_tasks": true,
      "can_view_strategic_goals": true,
      "can_invite_users": true,
      "can_manage_templates": true
    }'::jsonb
  );

  RETURN v_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept a team invitation
CREATE OR REPLACE FUNCTION accept_team_invitation(
  p_token TEXT,
  p_user_id UUID
)
RETURNS TABLE(team_id UUID, role TEXT) AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Find valid invitation
  SELECT * INTO v_invitation
  FROM team_invitations
  WHERE token = p_token
    AND expires_at > NOW()
    AND accepted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- Create membership
  INSERT INTO team_members (team_id, user_id, role, status)
  VALUES (v_invitation.team_id, p_user_id, v_invitation.role, 'active')
  ON CONFLICT (team_id, user_id) DO UPDATE
  SET status = 'active', role = v_invitation.role;

  -- Mark invitation as accepted
  UPDATE team_invitations
  SET accepted_at = NOW()
  WHERE id = v_invitation.id;

  -- Return result
  RETURN QUERY SELECT v_invitation.team_id, v_invitation.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_team_with_owner(TEXT, TEXT, UUID) IS 'Create team and add creator as owner';
COMMENT ON FUNCTION accept_team_invitation(TEXT, UUID) IS 'Accept team invitation and create membership';

-- ============================================
-- STEP 12: CREATE DATA MIGRATION FUNCTION
-- Copies data from agencies to teams tables
-- ============================================

CREATE OR REPLACE FUNCTION migrate_agencies_to_teams()
RETURNS void AS $$
BEGIN
  -- Copy agencies to teams (if not already exists)
  INSERT INTO teams (id, name, slug, logo_url, primary_color, secondary_color, subscription_tier, max_users, max_storage_mb, is_active, created_at, updated_at)
  SELECT id, name, slug, logo_url, primary_color, secondary_color, subscription_tier, max_users, max_storage_mb, is_active, created_at, updated_at
  FROM agencies
  ON CONFLICT (id) DO NOTHING;

  -- Copy agency_members to team_members
  INSERT INTO team_members (id, team_id, user_id, role, permissions, status, is_default_team, joined_at, created_at, updated_at)
  SELECT id, agency_id, user_id, role, permissions, status, is_default_agency, joined_at, created_at, updated_at
  FROM agency_members
  ON CONFLICT (team_id, user_id) DO NOTHING;

  -- Copy agency_invitations to team_invitations
  INSERT INTO team_invitations (id, team_id, email, role, token, invited_by, expires_at, accepted_at, created_at)
  SELECT id, agency_id, email, role, token, invited_by, expires_at, accepted_at, created_at
  FROM agency_invitations
  ON CONFLICT (id) DO NOTHING;

  -- Sync team_id on data tables where agency_id exists
  UPDATE todos SET team_id = agency_id WHERE team_id IS NULL AND agency_id IS NOT NULL;
  UPDATE messages SET team_id = agency_id WHERE team_id IS NULL AND agency_id IS NOT NULL;
  UPDATE activity_log SET team_id = agency_id WHERE team_id IS NULL AND agency_id IS NOT NULL;
  UPDATE task_templates SET team_id = agency_id WHERE team_id IS NULL AND agency_id IS NOT NULL;
  UPDATE strategic_goals SET team_id = agency_id WHERE team_id IS NULL AND agency_id IS NOT NULL;
  UPDATE goal_categories SET team_id = agency_id WHERE team_id IS NULL AND agency_id IS NOT NULL;

  RAISE NOTICE 'Migration from agencies to teams complete!';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION migrate_agencies_to_teams() IS 'Copy data from agency_* tables to team_* tables';

-- ============================================
-- STEP 13: EXECUTE DATA MIGRATION
-- ============================================

-- Run the migration automatically
SELECT migrate_agencies_to_teams();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE teams IS 'Multi-tenant teams - new terminology for academic context';
COMMENT ON TABLE team_members IS 'User-to-team relationships with roles and permissions';
COMMENT ON TABLE team_invitations IS 'Pending invitations for users to join teams';
