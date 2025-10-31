-- Migration 031: Fix function syntax errors in migration 030
-- This migration fixes the PL/pgSQL function syntax errors that prevent proper function creation

-- Fix find_eligible_swaps_optimized function
DROP FUNCTION IF EXISTS public.find_eligible_swaps_optimized(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.find_eligible_swaps_optimized(
  p_user_id uuid,
  p_target_swap_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  swap_id uuid, 
  source_booking_id uuid, 
  booking_title character varying, 
  booking_description text, 
  city character varying, 
  country character varying, 
  check_in_date timestamp with time zone, 
  check_out_date timestamp with time zone, 
  booking_type character varying, 
  estimated_value numeric, 
  swap_status character varying, 
  created_at timestamp with time zone
) 
LANGUAGE 'plpgsql'
COST 100
VOLATILE 
PARALLEL UNSAFE
ROWS 1000
AS $BODY$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as swap_id,
    s.source_booking_id,
    COALESCE(b.title, 'Untitled Booking') as booking_title,
    COALESCE(b.description, '') as booking_description,
    COALESCE(b.city, '') as city,
    COALESCE(b.country, '') as country,
    b.check_in_date,
    b.check_out_date,
    COALESCE(b.type, '') as booking_type,
    COALESCE(b.swap_value, 0) as estimated_value,
    s.status as swap_status,
    s.created_at
  FROM swaps s
  INNER JOIN bookings b ON s.source_booking_id = b.id
  WHERE b.user_id = p_user_id  -- Changed from s.owner_id to b.user_id
    AND s.status = 'pending'   -- Changed from 'active' to 'pending' to match current schema
    AND s.id != p_target_swap_id
    AND NOT EXISTS (
      SELECT 1 FROM swap_targets existing_target
      WHERE existing_target.source_swap_id = s.id
        AND existing_target.target_swap_id = p_target_swap_id
        AND existing_target.status IN ('active', 'accepted')
    )
  ORDER BY s.created_at DESC
  LIMIT p_limit;
END;
$BODY$;

-- Fix has_existing_proposal_optimized function
DROP FUNCTION IF EXISTS public.has_existing_proposal_optimized(uuid, uuid);

CREATE OR REPLACE FUNCTION public.has_existing_proposal_optimized(
  p_source_swap_id uuid,
  p_target_swap_id uuid
)
RETURNS boolean
LANGUAGE 'plpgsql'
COST 100
VOLATILE 
PARALLEL UNSAFE
AS $BODY$
DECLARE
  proposal_count INTEGER;
BEGIN
  -- Input validation for edge cases
  IF p_source_swap_id IS NULL OR p_target_swap_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- If both swap IDs are the same, return FALSE (can't propose to yourself)
  IF p_source_swap_id = p_target_swap_id THEN
    RETURN FALSE;
  END IF;
  
  -- Check for existing targeting relationships in both directions using swap_targets table
  -- This replaces the original booking pair logic with swap_targets table queries
  SELECT COUNT(*)
  INTO proposal_count
  FROM swap_targets st
  WHERE (
    (st.source_swap_id = p_source_swap_id AND st.target_swap_id = p_target_swap_id)
    OR
    (st.source_swap_id = p_target_swap_id AND st.target_swap_id = p_source_swap_id)
  )
  AND st.status IN ('active', 'accepted');
  
  RETURN proposal_count > 0;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but return FALSE to maintain backward compatibility
    -- This ensures the function doesn't break existing application logic
    RAISE WARNING 'Error in has_existing_proposal_optimized: % - %', SQLSTATE, SQLERRM;
    RETURN FALSE;
END;
$BODY$;

-- Add comments
COMMENT ON FUNCTION public.find_eligible_swaps_optimized(uuid, uuid, integer)
    IS 'Updated function to find eligible swaps using booking relationships instead of removed owner_id column';

COMMENT ON FUNCTION public.has_existing_proposal_optimized(uuid, uuid)
    IS 'Updated function to check existing proposals using swap_targets table instead of removed columns';