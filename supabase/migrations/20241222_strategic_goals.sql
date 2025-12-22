-- Strategic Goals table for owner dashboard
-- Notion-style boards with categories for long-term planning

-- Goal categories enum-like table for flexibility
CREATE TABLE IF NOT EXISTS goal_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT DEFAULT 'target',
  display_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default Allstate insurance agency categories
INSERT INTO goal_categories (name, color, icon, display_order) VALUES
  ('Revenue & Growth', '#10b981', 'trending-up', 1),
  ('Client Acquisition', '#3b82f6', 'users', 2),
  ('Team Development', '#8b5cf6', 'award', 3),
  ('Operations', '#f59e0b', 'settings', 4),
  ('Marketing', '#ec4899', 'megaphone', 5),
  ('Product Lines', '#06b6d4', 'shield', 6);

-- Strategic goals table
CREATE TABLE IF NOT EXISTS strategic_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES goal_categories(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  target_date DATE,
  target_value TEXT, -- e.g., "$1M revenue", "50 new clients"
  current_value TEXT, -- Progress tracking
  progress_percent INT DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  notes TEXT,
  display_order INT DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Goal milestones for breaking down larger goals
CREATE TABLE IF NOT EXISTS goal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES strategic_goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  target_date DATE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE goal_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_milestones ENABLE ROW LEVEL SECURITY;

-- Permissive policies (owner-only access will be enforced at app level)
CREATE POLICY "Allow all operations on goal_categories" ON goal_categories
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on strategic_goals" ON strategic_goals
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on goal_milestones" ON goal_milestones
  FOR ALL USING (true) WITH CHECK (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE strategic_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE goal_milestones;

-- Indexes for faster queries
CREATE INDEX idx_strategic_goals_category ON strategic_goals(category_id);
CREATE INDEX idx_strategic_goals_status ON strategic_goals(status);
CREATE INDEX idx_strategic_goals_created_by ON strategic_goals(created_by);
CREATE INDEX idx_goal_milestones_goal_id ON goal_milestones(goal_id);
