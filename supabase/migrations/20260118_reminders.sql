-- Reminders Feature Migration
-- Adds support for task reminders with flexible scheduling and notification tracking

-- Create reminder type enum
DO $$ BEGIN
    CREATE TYPE reminder_type AS ENUM ('push_notification', 'chat_message', 'both');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create reminder status enum
DO $$ BEGIN
    CREATE TYPE reminder_status AS ENUM ('pending', 'sent', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create reminders table
CREATE TABLE IF NOT EXISTS task_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    todo_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- User to remind (null = assigned user)
    reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reminder_type reminder_type DEFAULT 'both',
    status reminder_status DEFAULT 'pending',
    message TEXT,  -- Custom reminder message (optional)
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient reminder processing (find pending reminders due soon)
CREATE INDEX IF NOT EXISTS idx_task_reminders_pending_time
    ON task_reminders (reminder_time)
    WHERE status = 'pending';

-- Create index for todo lookups
CREATE INDEX IF NOT EXISTS idx_task_reminders_todo_id
    ON task_reminders (todo_id);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_task_reminders_user_id
    ON task_reminders (user_id)
    WHERE user_id IS NOT NULL;

-- Add reminder_at column to todos table for simple single-reminder use case
-- This is in addition to the task_reminders table for more complex scenarios
ALTER TABLE todos
    ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;

-- Create index for simple reminder column
CREATE INDEX IF NOT EXISTS idx_todos_reminder_pending
    ON todos (reminder_at)
    WHERE reminder_at IS NOT NULL AND reminder_sent = FALSE AND completed = FALSE;

-- Update function for updated_at timestamp
CREATE OR REPLACE FUNCTION update_task_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_task_reminders_updated_at ON task_reminders;
CREATE TRIGGER set_task_reminders_updated_at
    BEFORE UPDATE ON task_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_task_reminders_updated_at();

-- Enable RLS on task_reminders
ALTER TABLE task_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policy for task_reminders (same pattern as other tables)
DROP POLICY IF EXISTS "Allow all operations on task_reminders" ON task_reminders;
CREATE POLICY "Allow all operations on task_reminders" ON task_reminders
    FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for task_reminders
ALTER PUBLICATION supabase_realtime ADD TABLE task_reminders;

-- Add activity action types for reminders
-- Note: Activity actions are handled in the application layer via ActivityAction type

-- Function to automatically cancel reminders when task is completed
CREATE OR REPLACE FUNCTION cancel_reminders_on_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completed = TRUE AND OLD.completed = FALSE THEN
        -- Cancel pending reminders for this task
        UPDATE task_reminders
        SET status = 'cancelled', updated_at = NOW()
        WHERE todo_id = NEW.id AND status = 'pending';

        -- Mark simple reminder as sent to prevent future notifications
        NEW.reminder_sent = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-canceling reminders
DROP TRIGGER IF EXISTS cancel_reminders_on_task_completion ON todos;
CREATE TRIGGER cancel_reminders_on_task_completion
    BEFORE UPDATE ON todos
    FOR EACH ROW
    EXECUTE FUNCTION cancel_reminders_on_completion();

-- Function to get due reminders (for cron job or edge function)
CREATE OR REPLACE FUNCTION get_due_reminders(
    check_window_minutes INTEGER DEFAULT 5
)
RETURNS TABLE (
    reminder_id UUID,
    todo_id UUID,
    todo_text TEXT,
    todo_priority TEXT,
    assigned_to TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    user_id UUID,
    user_name TEXT,
    reminder_time TIMESTAMP WITH TIME ZONE,
    reminder_type reminder_type,
    custom_message TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        tr.id as reminder_id,
        t.id as todo_id,
        t.text as todo_text,
        t.priority as todo_priority,
        t.assigned_to,
        t.due_date,
        tr.user_id,
        COALESCE(u.name, t.assigned_to) as user_name,
        tr.reminder_time,
        tr.reminder_type,
        tr.message as custom_message
    FROM task_reminders tr
    JOIN todos t ON tr.todo_id = t.id
    LEFT JOIN users u ON tr.user_id = u.id
    WHERE tr.status = 'pending'
      AND t.completed = FALSE
      AND tr.reminder_time <= NOW() + (check_window_minutes || ' minutes')::interval
    ORDER BY tr.reminder_time ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to mark reminder as sent
CREATE OR REPLACE FUNCTION mark_reminder_sent(
    p_reminder_id UUID,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE task_reminders
    SET
        status = CASE WHEN p_error_message IS NULL THEN 'sent'::reminder_status ELSE 'failed'::reminder_status END,
        sent_at = CASE WHEN p_error_message IS NULL THEN NOW() ELSE NULL END,
        error_message = p_error_message,
        retry_count = CASE WHEN p_error_message IS NOT NULL THEN retry_count + 1 ELSE retry_count END,
        updated_at = NOW()
    WHERE id = p_reminder_id;
END;
$$ LANGUAGE plpgsql;

-- Insert comments for documentation
COMMENT ON TABLE task_reminders IS 'Stores task reminders with support for multiple reminders per task, flexible notification types, and tracking';
COMMENT ON COLUMN task_reminders.reminder_type IS 'Type of notification: push_notification, chat_message, or both';
COMMENT ON COLUMN task_reminders.status IS 'Reminder status: pending (not yet sent), sent, failed, or cancelled (task completed)';
COMMENT ON COLUMN task_reminders.user_id IS 'User to remind. If NULL, reminder goes to the assigned user of the task';
COMMENT ON COLUMN todos.reminder_at IS 'Simple single reminder time for quick reminder setting';
COMMENT ON COLUMN todos.reminder_sent IS 'Whether the simple reminder has been sent';
