-- Fix variable naming conflict in has_existing_proposal_optimized function
-- The function had variable names that conflicted with column names in the SQL query

CREATE OR REPLACE FUNCTION has_existing_proposal_optimized(
  p_source_swap_id UUID,
  p_target_swap_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_source_booking_id UUID;
  v_target_booking_id UUID;
  proposal_count INTEGER;
BEGIN
  -- Get booking IDs for both swaps
  SELECT s1.source_booking_id, s2.source_booking_id
  INTO v_source_booking_id, v_target_booking_id
  FROM swaps s1, swaps s2
  WHERE s1.id = p_source_swap_id AND s2.id = p_target_swap_id;
  
  -- Check for existing proposals in both directions
  SELECT COUNT(*)
  INTO proposal_count
  FROM swaps
  WHERE (
    (swaps.source_booking_id = v_source_booking_id AND swaps.target_booking_id = v_target_booking_id)
    OR
    (swaps.source_booking_id = v_target_booking_id AND swaps.target_booking_id = v_source_booking_id)
  )
  AND status IN ('pending', 'accepted');
  
  RETURN proposal_count > 0;
END;
$$ LANGUAGE plpgsql;
