-- Migration: Security Hardening - Permanent RLS & Audit Triggers
-- Date: 2026-01-25
-- Description: Remove RLS feature flag, make RLS permanent, add database-level audit triggers

-- ============================================
-- STEP 1: REMOVE RLS FEATURE FLAG
-- Make RLS mandatory - cannot be disabled
-- ============================================

-- Drop the feature flag function
DROP FUNCTION IF EXISTS public.rls_enabled() CASCADE;

-- ============================================
-- STEP 2: RECREATE POLICIES WITHOUT FEATURE FLAG
-- All policies now always enforce access control
-- ============================================

-- Drop existing policies with feature flag
DROP POLICY IF EXISTS "rls_todos_select" ON todos;
DROP POLICY IF EXISTS "rls_todos_insert" ON todos;
DROP POLICY IF EXISTS "rls_todos_update" ON todos;
DROP POLICY IF EXISTS "rls_todos_delete" ON todos;
DROP POLICY IF EXISTS "rls_messages_select" ON messages;
DROP POLICY IF EXISTS "rls_messages_insert" ON messages;
DROP POLICY IF EXISTS "rls_messages_update" ON messages;
DROP POLICY IF EXISTS "rls_messages_delete" ON messages;
DROP POLICY IF EXISTS "rls_goals_select" ON strategic_goals;
DROP POLICY IF EXISTS "rls_goals_insert" ON strategic_goals;
DROP POLICY IF EXISTS "rls_goals_update" ON strategic_goals;
DROP POLICY IF EXISTS "rls_goals_delete" ON strategic_goals;
DROP POLICY IF EXISTS "rls_milestones_select" ON goal_milestones;
DROP POLICY IF EXISTS "rls_milestones_insert" ON goal_milestones;
DROP POLICY IF EXISTS "rls_milestones_update" ON goal_milestones;
DROP POLICY IF EXISTS "rls_milestones_delete" ON goal_milestones;
DROP POLICY IF EXISTS "rls_users_update" ON users;
DROP POLICY IF EXISTS "rls_users_delete" ON users;

-- TODOS POLICIES (Always enforced)
CREATE POLICY "todos_select_policy"
  ON todos FOR SELECT
  USING (
    assigned_to = public.get_user_name() OR
    created_by = public.get_user_name() OR
    public.is_admin()
  );

CREATE POLICY "todos_insert_policy"
  ON todos FOR INSERT
  WITH CHECK (created_by = public.get_user_name());

CREATE POLICY "todos_update_policy"
  ON todos FOR UPDATE
  USING (
    assigned_to = public.get_user_name() OR
    created_by = public.get_user_name() OR
    public.is_admin()
  )
  WITH CHECK (
    assigned_to = public.get_user_name() OR
    created_by = public.get_user_name() OR
    public.is_admin()
  );

CREATE POLICY "todos_delete_policy"
  ON todos FOR DELETE
  USING (
    created_by = public.get_user_name() OR
    public.is_admin()
  );

-- MESSAGES POLICIES (Always enforced)
CREATE POLICY "messages_select_policy"
  ON messages FOR SELECT
  USING (
    recipient IS NULL OR -- Team chat visible to all
    recipient = public.get_user_name() OR -- DM to me
    created_by = public.get_user_name() -- My messages
  );

CREATE POLICY "messages_insert_policy"
  ON messages FOR INSERT
  WITH CHECK (created_by = public.get_user_name());

CREATE POLICY "messages_update_policy"
  ON messages FOR UPDATE
  USING (created_by = public.get_user_name());

CREATE POLICY "messages_delete_policy"
  ON messages FOR DELETE
  USING (
    created_by = public.get_user_name() OR
    public.is_admin()
  );

-- STRATEGIC GOALS POLICIES (Admin only, always enforced)
CREATE POLICY "goals_select_policy"
  ON strategic_goals FOR SELECT
  USING (public.is_admin());

CREATE POLICY "goals_insert_policy"
  ON strategic_goals FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "goals_update_policy"
  ON strategic_goals FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "goals_delete_policy"
  ON strategic_goals FOR DELETE
  USING (public.is_admin());

-- GOAL MILESTONES POLICIES (Admin only)
CREATE POLICY "milestones_select_policy"
  ON goal_milestones FOR SELECT
  USING (public.is_admin());

CREATE POLICY "milestones_insert_policy"
  ON goal_milestones FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "milestones_update_policy"
  ON goal_milestones FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "milestones_delete_policy"
  ON goal_milestones FOR DELETE
  USING (public.is_admin());

-- USERS POLICIES (Always enforced)
CREATE POLICY "users_update_policy"
  ON users FOR UPDATE
  USING (id = public.get_user_id());

CREATE POLICY "users_delete_policy"
  ON users FOR DELETE
  USING (public.is_admin());

-- ============================================
-- STEP 3: CREATE SECURITY AUDIT LOG TABLE
-- Append-only table for compliance
-- ============================================

CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  user_id UUID,
  user_name TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index for querying
CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON security_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_table_name ON security_audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON security_audit_log(user_id);

-- Make table append-only (no updates or deletes)
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_audit_insert_only"
  ON security_audit_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "security_audit_select_admin"
  ON security_audit_log FOR SELECT
  USING (public.is_admin());

-- Explicitly deny updates and deletes
CREATE POLICY "security_audit_no_update"
  ON security_audit_log FOR UPDATE
  USING (false);

CREATE POLICY "security_audit_no_delete"
  ON security_audit_log FOR DELETE
  USING (false);

-- ============================================
-- STEP 4: CREATE AUDIT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  audit_user_id UUID;
  audit_user_name TEXT;
BEGIN
  -- Get current user context
  audit_user_id := NULLIF(current_setting('app.user_id', true), '')::UUID;
  audit_user_name := current_setting('app.user_name', true);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO security_audit_log (
      event_type,
      table_name,
      record_id,
      user_id,
      user_name,
      new_data
    ) VALUES (
      'INSERT',
      TG_TABLE_NAME,
      NEW.id,
      audit_user_id,
      audit_user_name,
      to_jsonb(NEW)
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO security_audit_log (
      event_type,
      table_name,
      record_id,
      user_id,
      user_name,
      old_data,
      new_data
    ) VALUES (
      'UPDATE',
      TG_TABLE_NAME,
      NEW.id,
      audit_user_id,
      audit_user_name,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO security_audit_log (
      event_type,
      table_name,
      record_id,
      user_id,
      user_name,
      old_data
    ) VALUES (
      'DELETE',
      TG_TABLE_NAME,
      OLD.id,
      audit_user_id,
      audit_user_name,
      to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 5: ATTACH AUDIT TRIGGERS TO TABLES
-- ============================================

-- Users table
DROP TRIGGER IF EXISTS audit_users_trigger ON users;
CREATE TRIGGER audit_users_trigger
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Todos table
DROP TRIGGER IF EXISTS audit_todos_trigger ON todos;
CREATE TRIGGER audit_todos_trigger
  AFTER INSERT OR UPDATE OR DELETE ON todos
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Messages table
DROP TRIGGER IF EXISTS audit_messages_trigger ON messages;
CREATE TRIGGER audit_messages_trigger
  AFTER INSERT OR UPDATE OR DELETE ON messages
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Strategic goals table
DROP TRIGGER IF EXISTS audit_strategic_goals_trigger ON strategic_goals;
CREATE TRIGGER audit_strategic_goals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON strategic_goals
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- User sessions table (for security monitoring)
DROP TRIGGER IF EXISTS audit_user_sessions_trigger ON user_sessions;
CREATE TRIGGER audit_user_sessions_trigger
  AFTER INSERT OR UPDATE OR DELETE ON user_sessions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================
-- STEP 6: ADD IDLE TIMEOUT SUPPORT
-- ============================================

-- Add last_activity column to user_sessions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_sessions' AND column_name = 'last_activity'
  ) THEN
    ALTER TABLE user_sessions ADD COLUMN last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Create function to check idle timeout
CREATE OR REPLACE FUNCTION check_session_idle_timeout(
  p_token_hash TEXT,
  p_idle_timeout_minutes INTEGER DEFAULT 30
)
RETURNS BOOLEAN AS $$
DECLARE
  session_record RECORD;
BEGIN
  SELECT * INTO session_record
  FROM user_sessions
  WHERE token_hash = p_token_hash
    AND is_valid = true
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check idle timeout
  IF session_record.last_activity IS NOT NULL AND
     session_record.last_activity < NOW() - (p_idle_timeout_minutes || ' minutes')::INTERVAL THEN
    -- Session has been idle too long, invalidate it
    UPDATE user_sessions SET is_valid = false WHERE token_hash = p_token_hash;
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 7: CREATE AUTHENTICATION FAILURE LOG
-- ============================================

CREATE TABLE IF NOT EXISTS auth_failure_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'login_failed', 'invalid_session', 'unauthorized_access'
  user_name TEXT,
  ip_address INET,
  user_agent TEXT,
  endpoint TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for querying recent failures
CREATE INDEX IF NOT EXISTS idx_auth_failure_created_at ON auth_failure_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_failure_ip ON auth_failure_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_auth_failure_user ON auth_failure_log(user_name);

-- RLS for auth failure log (append-only, admin read)
ALTER TABLE auth_failure_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_failure_insert_only"
  ON auth_failure_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "auth_failure_select_admin"
  ON auth_failure_log FOR SELECT
  USING (public.is_admin());

-- ============================================
-- STEP 8: COMMENTS
-- ============================================

COMMENT ON TABLE security_audit_log IS 'Append-only audit log for compliance. Cannot be modified or deleted.';
COMMENT ON TABLE auth_failure_log IS 'Log of authentication and authorization failures for security monitoring.';
COMMENT ON FUNCTION audit_trigger_func() IS 'Trigger function that logs all changes to audited tables.';
COMMENT ON FUNCTION check_session_idle_timeout(TEXT, INTEGER) IS 'Check if session has been idle too long and invalidate if necessary.';
