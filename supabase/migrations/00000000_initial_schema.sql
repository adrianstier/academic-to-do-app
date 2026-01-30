-- ============================================
-- Initial Schema for Academic Project Manager
-- This creates the core tables needed by the application
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    pin_hash TEXT, -- Deprecated: Use OAuth instead
    color TEXT DEFAULT '#4F46E5', -- Indigo (Academic Primary)
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    streak_count INTEGER DEFAULT 0,
    streak_last_date DATE,
    welcome_shown_at TIMESTAMP WITH TIME ZONE
);

-- Index for email lookups (OAuth)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- TODOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT NOT NULL,
    assigned_to TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    recurrence TEXT CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekly', 'monthly')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT,
    subtasks JSONB DEFAULT '[]'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    transcription TEXT,
    merged_from UUID[],
    reminder_at TIMESTAMP WITH TIME ZONE,
    reminder_sent BOOLEAN DEFAULT FALSE,
    category TEXT, -- Academic categories: research, writing, analysis, etc.
    agency_id UUID, -- Deprecated: Use team_id
    team_id UUID
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_todos_created_by ON todos(created_by);
CREATE INDEX IF NOT EXISTS idx_todos_assigned_to ON todos(assigned_to);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
CREATE INDEX IF NOT EXISTS idx_todos_team_id ON todos(team_id);

-- ============================================
-- MESSAGES TABLE (Chat)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    related_todo_id UUID REFERENCES todos(id) ON DELETE SET NULL,
    recipient TEXT, -- NULL for team chat, user name for DMs
    reactions JSONB DEFAULT '[]'::jsonb,
    read_by TEXT[] DEFAULT '{}',
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    reply_to_text TEXT,
    reply_to_user TEXT,
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_pinned BOOLEAN DEFAULT FALSE,
    pinned_by TEXT,
    pinned_at TIMESTAMP WITH TIME ZONE,
    mentions TEXT[] DEFAULT '{}',
    agency_id UUID, -- Deprecated: Use team_id
    team_id UUID
);

-- Indexes for message queries
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created_by ON messages(created_by);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient);
CREATE INDEX IF NOT EXISTS idx_messages_related_todo ON messages(related_todo_id);
CREATE INDEX IF NOT EXISTS idx_messages_team_id ON messages(team_id);

-- ============================================
-- TASK TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    default_priority TEXT DEFAULT 'medium' CHECK (default_priority IN ('low', 'medium', 'high', 'urgent')),
    default_assigned_to TEXT,
    subtasks JSONB DEFAULT '[]'::jsonb,
    created_by TEXT NOT NULL,
    is_shared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    agency_id UUID,
    team_id UUID
);

-- ============================================
-- GOAL CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS goal_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    icon TEXT,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default academic goal categories
INSERT INTO goal_categories (name, color, icon, display_order) VALUES
    ('Research Goals', '#10B981', 'flask', 1),
    ('Publication Goals', '#3B82F6', 'file-text', 2),
    ('Professional Development', '#8B5CF6', 'trending-up', 3),
    ('Academic Service', '#F59E0B', 'users', 4),
    ('Teaching & Curriculum', '#EC4899', 'graduation-cap', 5),
    ('Career Milestones', '#6366F1', 'target', 6)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- STRATEGIC GOALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS strategic_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES goal_categories(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'on_hold', 'completed', 'cancelled')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    target_date DATE,
    target_value TEXT,
    current_value TEXT,
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    notes TEXT,
    display_order INTEGER,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    agency_id UUID,
    team_id UUID
);

-- ============================================
-- GOAL MILESTONES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS goal_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES strategic_goals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    target_date DATE,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for milestone queries
CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal_id ON goal_milestones(goal_id);

-- ============================================
-- NEXTAUTH TABLES (OAuth Support)
-- ============================================

-- Accounts table for OAuth providers
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at BIGINT,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- Sessions table for NextAuth
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);

-- Verification tokens for email verification
CREATE TABLE IF NOT EXISTS verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (identifier, token)
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS todos_updated_at ON todos;
CREATE TRIGGER todos_updated_at
    BEFORE UPDATE ON todos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS task_templates_updated_at ON task_templates;
CREATE TRIGGER task_templates_updated_at
    BEFORE UPDATE ON task_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS strategic_goals_updated_at ON strategic_goals;
CREATE TRIGGER strategic_goals_updated_at
    BEFORE UPDATE ON strategic_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS accounts_updated_at ON accounts;
CREATE TRIGGER accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;

-- Permissive policies (access control at app level)
CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on todos" ON todos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on task_templates" ON task_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on goal_categories" ON goal_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on strategic_goals" ON strategic_goals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on goal_milestones" ON goal_milestones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on verification_tokens" ON verification_tokens FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- REAL-TIME SUBSCRIPTIONS
-- ============================================

-- Add tables to real-time publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE todos;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE strategic_goals;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE goal_milestones;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================
-- DONE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Initial schema created successfully for Academic Project Manager';
END $$;
