-- Task Patterns Migration
-- Stores learned patterns from historical task data for smart task suggestions

-- Create task_patterns table
CREATE TABLE IF NOT EXISTS task_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_text TEXT NOT NULL,
  category TEXT NOT NULL,
  occurrence_count INTEGER DEFAULT 1,
  avg_priority TEXT DEFAULT 'medium',
  common_subtasks JSONB DEFAULT '[]'::jsonb,
  last_occurrence TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_task_patterns_category ON task_patterns(category);
CREATE INDEX IF NOT EXISTS idx_task_patterns_occurrence ON task_patterns(occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_task_patterns_pattern_text ON task_patterns(pattern_text);

-- Add unique constraint on pattern_text to allow upsert
ALTER TABLE task_patterns ADD CONSTRAINT task_patterns_pattern_text_unique UNIQUE (pattern_text);

-- Enable RLS
ALTER TABLE task_patterns ENABLE ROW LEVEL SECURITY;

-- Create permissive policy (access control at application level)
CREATE POLICY "Allow all operations on task_patterns"
  ON task_patterns
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON task_patterns TO authenticated;
GRANT ALL ON task_patterns TO anon;

-- Enable real-time (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE task_patterns;

-- Insert some default patterns based on common insurance tasks
INSERT INTO task_patterns (pattern_text, category, occurrence_count, avg_priority, common_subtasks) VALUES
  ('Policy review', 'policy_review', 10, 'medium', '["Review current coverage limits", "Check for discount opportunities", "Verify contact information", "Prepare renewal quote"]'::jsonb),
  ('Add vehicle to policy', 'vehicle_add', 8, 'high', '["Collect VIN and vehicle information", "Verify registration", "Calculate premium change", "Update policy and send new dec page"]'::jsonb),
  ('New client onboarding', 'new_client', 6, 'high', '["Gather customer information", "Pull MVR for all drivers", "Run quotes with multiple carriers", "Present options and bind coverage", "Set up account in management system", "Send welcome packet"]'::jsonb),
  ('Process claim', 'claim', 5, 'urgent', '["File claim with carrier", "Document incident details", "Coordinate with adjuster", "Follow up on claim status", "Update customer on progress"]'::jsonb),
  ('Quote request', 'quote', 7, 'medium', '["Gather customer information", "Run quotes with carriers", "Compare coverage options", "Prepare and send proposal"]'::jsonb),
  ('Payment issue', 'payment', 4, 'high', '["Review account status", "Contact carrier if needed", "Resolve payment issue", "Confirm with customer"]'::jsonb)
ON CONFLICT (pattern_text) DO NOTHING;

COMMENT ON TABLE task_patterns IS 'Stores learned patterns from historical task data for intelligent task suggestions';
