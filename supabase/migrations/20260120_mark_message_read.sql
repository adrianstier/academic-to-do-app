-- Migration: Add mark_message_read RPC function
-- This function atomically appends a username to the read_by array
-- avoiding race conditions when multiple tabs/users mark the same message as read

-- Create the function to mark a message as read
CREATE OR REPLACE FUNCTION public.mark_message_read(
  p_message_id UUID,
  p_user_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only update if the user hasn't already read this message
  -- Uses array_append which is atomic and avoids race conditions
  UPDATE public.messages
  SET read_by = array_append(read_by, p_user_name)
  WHERE id = p_message_id
    AND NOT (p_user_name = ANY(COALESCE(read_by, ARRAY[]::TEXT[])));
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.mark_message_read(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_message_read(UUID, TEXT) TO anon;

-- Add comment
COMMENT ON FUNCTION public.mark_message_read IS 'Atomically mark a message as read by a user, avoiding race conditions';
