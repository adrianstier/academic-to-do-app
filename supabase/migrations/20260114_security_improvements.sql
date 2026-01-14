-- Migration: Comprehensive Security Improvements
-- Date: 2026-01-14
-- Description: Enable RLS by default, add audit logging, add user roles and storage quotas

-- ============================================
-- ENABLE RLS BY DEFAULT
-- ============================================

-- Update the rls_enabled function to default to TRUE for security
CREATE OR REPLACE FUNCTION auth.rls_enabled()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    current_setting('app.enable_rls', true)::boolean,
    true  -- DEFAULT TO TRUE (was false)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION auth.rls_enabled() IS 'Check if RLS is enabled - defaults to TRUE for security';

-- ============================================
-- ADD USER ROLES
-- ============================================

-- Add role column to users table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member'
      CHECK (role IN ('owner', 'admin', 'member'));
  END IF;
END $$;

-- Set Derrick as owner (the agency owner)
UPDATE users SET role = 'owner' WHERE name = 'Derrick' AND role = 'member';

-- Update is_admin function to check for owner or admin role
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
  SELECT role IN ('owner', 'admin') FROM users WHERE id = auth.user_id();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION auth.is_admin() IS 'Check if current user is owner or admin';

-- ============================================
-- ADD USER STORAGE QUOTAS
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'storage_used_bytes'
  ) THEN
    ALTER TABLE users ADD COLUMN storage_used_bytes BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'storage_quota_bytes'
  ) THEN
    -- 100MB default quota per user
    ALTER TABLE users ADD COLUMN storage_quota_bytes BIGINT DEFAULT 104857600;
  END IF;
END $$;

-- ============================================
-- CREATE SECURITY AUDIT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  user_id UUID,
  user_name TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_audit_time ON security_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_user ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_table ON security_audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_security_audit_event ON security_audit_log(event_type);

-- Enable RLS on audit log
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit log
CREATE POLICY "rls_security_audit_select"
  ON security_audit_log FOR SELECT
  USING (auth.is_admin());

-- System can insert audit entries
CREATE POLICY "rls_security_audit_insert"
  ON security_audit_log FOR INSERT
  WITH CHECK (true);

-- No updates or deletes allowed (append-only)

-- ============================================
-- CREATE AUDIT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION security_audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO security_audit_log (
    event_type,
    table_name,
    record_id,
    user_name,
    old_data,
    new_data
  ) VALUES (
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    current_setting('app.current_user_name', true),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- APPLY AUDIT TRIGGERS TO SENSITIVE TABLES
-- ============================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS security_audit_users ON users;
DROP TRIGGER IF EXISTS security_audit_todos ON todos;
DROP TRIGGER IF EXISTS security_audit_messages ON messages;
DROP TRIGGER IF EXISTS security_audit_strategic_goals ON strategic_goals;

-- Create triggers for sensitive tables
CREATE TRIGGER security_audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION security_audit_trigger_function();

CREATE TRIGGER security_audit_todos
  AFTER INSERT OR UPDATE OR DELETE ON todos
  FOR EACH ROW EXECUTE FUNCTION security_audit_trigger_function();

CREATE TRIGGER security_audit_messages
  AFTER INSERT OR UPDATE OR DELETE ON messages
  FOR EACH ROW EXECUTE FUNCTION security_audit_trigger_function();

CREATE TRIGGER security_audit_strategic_goals
  AFTER INSERT OR UPDATE OR DELETE ON strategic_goals
  FOR EACH ROW EXECUTE FUNCTION security_audit_trigger_function();

-- ============================================
-- CREATE USER SESSIONS TABLE FOR SECURE SESSION MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  is_valid BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_valid ON user_sessions(is_valid) WHERE is_valid = TRUE;

-- Enable RLS on sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "rls_sessions_select"
  ON user_sessions FOR SELECT
  USING (
    CASE
      WHEN auth.rls_enabled() THEN user_id = auth.user_id()
      ELSE true
    END
  );

-- System can insert sessions
CREATE POLICY "rls_sessions_insert"
  ON user_sessions FOR INSERT
  WITH CHECK (true);

-- Users can update their own sessions (for logout)
CREATE POLICY "rls_sessions_update"
  ON user_sessions FOR UPDATE
  USING (
    CASE
      WHEN auth.rls_enabled() THEN user_id = auth.user_id()
      ELSE true
    END
  );

-- ============================================
-- FUNCTION TO VALIDATE SESSION TOKEN
-- ============================================

CREATE OR REPLACE FUNCTION validate_session_token(p_token_hash TEXT)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  user_role TEXT,
  valid BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.user_id,
    u.name,
    u.role,
    (s.is_valid AND s.expires_at > NOW()) as valid
  FROM user_sessions s
  JOIN users u ON u.id = s.user_id
  WHERE s.token_hash = p_token_hash
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION TO UPDATE STORAGE USAGE
-- ============================================

CREATE OR REPLACE FUNCTION update_user_storage(
  p_user_name TEXT,
  p_bytes_delta BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_usage BIGINT;
  v_quota BIGINT;
BEGIN
  SELECT storage_used_bytes, storage_quota_bytes
  INTO v_current_usage, v_quota
  FROM users WHERE name = p_user_name;

  -- Check if adding would exceed quota (for positive delta)
  IF p_bytes_delta > 0 AND (v_current_usage + p_bytes_delta) > v_quota THEN
    RETURN FALSE;
  END IF;

  -- Update the storage usage
  UPDATE users
  SET storage_used_bytes = GREATEST(0, storage_used_bytes + p_bytes_delta)
  WHERE name = p_user_name;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CLEANUP FUNCTION FOR EXPIRED SESSIONS
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions
  WHERE expires_at < NOW() OR is_valid = FALSE;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE security_audit_log IS 'Append-only security audit log for tracking all data changes';
COMMENT ON TABLE user_sessions IS 'Secure session management with expiration';
COMMENT ON FUNCTION security_audit_trigger_function() IS 'Automatically logs all changes to audited tables';
COMMENT ON FUNCTION validate_session_token(TEXT) IS 'Validates a session token and returns user info';
COMMENT ON FUNCTION update_user_storage(TEXT, BIGINT) IS 'Updates user storage usage, respecting quota';
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Removes expired and invalid sessions';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT ON security_audit_log TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON user_sessions TO authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_session_token(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_user_storage(TEXT, BIGINT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO authenticated, anon;
