-- Migration: Update goal categories from insurance to academic terminology
-- This migration transforms the goal_categories table from Allstate insurance
-- categories to academic project milestone categories.

-- Delete the old insurance-specific categories
-- This will cascade to any goals that were assigned these categories (category_id will become NULL)
DELETE FROM goal_categories WHERE name IN (
  'Revenue & Growth',
  'Client Acquisition',
  'Team Development',
  'Operations',
  'Marketing',
  'Product Lines'
);

-- Insert new academic goal categories
INSERT INTO goal_categories (name, color, icon, display_order) VALUES
  ('Research Goals', '#10B981', 'flask', 1),           -- Green - Research, experiments, data collection
  ('Publication Goals', '#3B82F6', 'file-text', 2),    -- Blue - Papers, manuscripts, journal submissions
  ('Professional Development', '#8B5CF6', 'trending-up', 3), -- Purple - Skills, training, networking
  ('Academic Service', '#F59E0B', 'users', 4),         -- Amber - Committee work, peer review, mentoring
  ('Teaching & Curriculum', '#EC4899', 'graduation-cap', 5), -- Pink - Courses, TA work, curriculum development
  ('Career Milestones', '#6366F1', 'target', 6);       -- Indigo - Tenure, promotions, major achievements

-- Add a comment to document the migration
COMMENT ON TABLE goal_categories IS 'Academic project goal categories for research and academic progress tracking';
