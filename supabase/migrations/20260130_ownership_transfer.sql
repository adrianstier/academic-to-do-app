-- ============================================
-- Ownership Transfer RPC
-- Allows a team owner to transfer ownership to another active member
-- ============================================

CREATE OR REPLACE FUNCTION public.transfer_team_ownership(
  p_team_id UUID,
  p_current_owner_id UUID,
  p_new_owner_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_role TEXT;
  v_new_member_status TEXT;
BEGIN
  -- Verify caller is the current owner
  SELECT role INTO v_current_role
  FROM team_members
  WHERE team_id = p_team_id AND user_id = p_current_owner_id AND status = 'active';

  IF v_current_role IS NULL OR v_current_role != 'owner' THEN
    RAISE EXCEPTION 'Only the current team owner can transfer ownership';
  END IF;

  -- Verify target is an active member of the team
  SELECT status INTO v_new_member_status
  FROM team_members
  WHERE team_id = p_team_id AND user_id = p_new_owner_id;

  IF v_new_member_status IS NULL OR v_new_member_status != 'active' THEN
    RAISE EXCEPTION 'Target user must be an active member of the team';
  END IF;

  -- Demote current owner to admin
  UPDATE team_members
  SET role = 'admin', updated_at = NOW()
  WHERE team_id = p_team_id AND user_id = p_current_owner_id;

  -- Promote new owner
  UPDATE team_members
  SET role = 'owner', updated_at = NOW()
  WHERE team_id = p_team_id AND user_id = p_new_owner_id;
END;
$$;

-- Grant execute to authenticated users (RPC checks ownership internally)
GRANT EXECUTE ON FUNCTION public.transfer_team_ownership(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_team_ownership(UUID, UUID, UUID) TO anon;
