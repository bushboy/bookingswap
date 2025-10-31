-- Diagnostic query to verify swap_targets and booking relationships
-- This helps us understand the data flow for incoming proposals

-- Step 1: Check sample data structure
SELECT 
  'Sample swap_targets data' as info,
  st.id as swap_target_id,
  st.source_swap_id as proposer_swap_id,
  st.target_swap_id as target_user_swap_id,
  st.status
FROM swap_targets st
LIMIT 5;

-- Step 2: Trace through the JOIN logic for a specific user
-- Replace 'YOUR_USER_ID' with an actual user ID that has incoming proposals
WITH user_swaps AS (
  SELECT s.id, s.source_booking_id, sb.user_id, sb.title as user_booking_title
  FROM swaps s
  JOIN bookings sb ON s.source_booking_id = sb.id
  WHERE sb.user_id = 'YOUR_USER_ID'  -- Replace with actual user ID
  LIMIT 1
)
SELECT 
  'Data flow verification' as step,
  us.id as user_swap_id,
  us.user_booking_title as "User's Booking",
  
  st.id as swap_target_id,
  st.source_swap_id as proposer_swap_id,
  
  proposer_swap.id as "Proposer Swap ID",
  proposer_swap.source_booking_id as "Proposer's Source Booking ID",
  
  proposer_booking.id as "Proposer Booking ID",
  proposer_booking.title as "Proposer Booking Title",
  proposer_booking.city as "Proposer City",
  proposer_booking.country as "Proposer Country",
  proposer_booking.user_id as "Proposer User ID",
  
  proposer_user.display_name as "Proposer Name",
  
  owner_user.display_name as "Owner Name (should be current user)"
  
FROM user_swaps us
LEFT JOIN swap_targets st ON us.id = st.target_swap_id AND st.status = 'active'
LEFT JOIN swaps proposer_swap ON st.source_swap_id = proposer_swap.id
LEFT JOIN bookings proposer_booking ON proposer_swap.source_booking_id = proposer_booking.id
LEFT JOIN bookings owner_booking ON us.source_booking_id = owner_booking.id
LEFT JOIN users proposer_user ON proposer_booking.user_id = proposer_user.id
LEFT JOIN users owner_user ON owner_booking.user_id = owner_user.id;

-- Step 3: Check what the current query returns
SELECT 
  s.id as swap_id,
  sb.title as user_booking_title,
  sb.city as user_city,
  sb.country as user_country,
  
  tb.id as proposer_booking_id,
  tb.title as proposer_booking_title,
  tb.city as proposer_city,
  tb.country as proposer_country,
  
  u.display_name as joined_user_name,
  sb.user_id as sb_user_id,
  tb.user_id as tb_user_id,
  u.id as u_id

FROM swaps s
JOIN bookings sb ON s.source_booking_id = sb.id
LEFT JOIN swap_targets st ON s.id = st.target_swap_id AND st.status = 'active'
LEFT JOIN swaps ts ON st.source_swap_id = ts.id
LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
JOIN users u ON sb.user_id = u.id  -- <-- THIS IS THE PROBLEM!

WHERE sb.user_id = 'YOUR_USER_ID'  -- Replace with actual user ID
ORDER BY s.created_at DESC
LIMIT 5;

