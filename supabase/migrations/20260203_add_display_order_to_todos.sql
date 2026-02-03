-- Migration: Add display_order column to todos table for manual task reordering
-- Date: 2026-02-03
-- Purpose: Enable drag-and-drop task reordering functionality

-- Add display_order column (nullable initially for backwards compatibility)
ALTER TABLE todos
ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Create index for performance when sorting by display_order
CREATE INDEX IF NOT EXISTS idx_todos_display_order ON todos(display_order);

-- Set initial values based on created_at DESC (newest first)
-- This gives each existing task a unique display_order
UPDATE todos
SET display_order = subquery.row_number
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS row_number
  FROM todos
  WHERE display_order IS NULL
) AS subquery
WHERE todos.id = subquery.id
AND todos.display_order IS NULL;

-- Make display_order NOT NULL now that all rows have values
-- Use a default of 0 for any new inserts (will be updated by app logic)
ALTER TABLE todos
ALTER COLUMN display_order SET DEFAULT 0,
ALTER COLUMN display_order SET NOT NULL;

-- Update RLS policies (if any exist) to allow display_order updates
-- Note: Existing RLS policies should already allow updates, but we verify here
DO $$
BEGIN
  -- Check if RLS is enabled and policies exist
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos'
    AND policyname LIKE '%update%'
  ) THEN
    -- RLS policies exist, they should already allow display_order updates
    -- No action needed as existing UPDATE policies cover all columns
    RAISE NOTICE 'RLS policies found - display_order updates will be governed by existing policies';
  ELSE
    RAISE NOTICE 'No RLS update policies found - display_order updates will use default permissions';
  END IF;
END $$;

-- Add comment to document the column
COMMENT ON COLUMN todos.display_order IS 'Manual sort order for drag-and-drop task reordering. Lower values appear first in the list.';
