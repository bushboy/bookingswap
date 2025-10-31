-- Migration: Add NFT fields to bookings table
-- Created: 2024-12-07
-- Description: Adds NFT-related fields to track blockchain tokens for bookings

-- Add NFT fields to bookings table
ALTER TABLE bookings 
ADD COLUMN nft_token_id VARCHAR(50),
ADD COLUMN nft_serial_number INTEGER,
ADD COLUMN nft_transaction_id VARCHAR(255);

-- Create indexes for NFT fields
CREATE INDEX idx_bookings_nft_token_id ON bookings(nft_token_id);
CREATE INDEX idx_bookings_nft_serial_number ON bookings(nft_serial_number);
CREATE INDEX idx_bookings_nft_transaction_id ON bookings(nft_transaction_id);

-- Add comments for documentation
COMMENT ON COLUMN bookings.nft_token_id IS 'Hedera token ID for the booking NFT';
COMMENT ON COLUMN bookings.nft_serial_number IS 'Serial number of the minted NFT';
COMMENT ON COLUMN bookings.nft_transaction_id IS 'Transaction ID of the NFT minting transaction';
