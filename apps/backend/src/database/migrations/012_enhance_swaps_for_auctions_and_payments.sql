-- Migration: Enhance swaps table for auctions and payments
-- Created: 2024-12-07
-- Description: Adds payment types and acceptance strategy to swaps table, creates auction and payment tables

-- First, add new columns to existing swaps table
ALTER TABLE swaps 
ADD COLUMN payment_types JSONB NOT NULL DEFAULT '{"bookingExchange": true, "cashPayment": false}',
ADD COLUMN acceptance_strategy JSONB NOT NULL DEFAULT '{"type": "first_match"}',
ADD COLUMN cash_details JSONB;

-- Create swap_auctions table
CREATE TABLE IF NOT EXISTS swap_auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swap_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
    settings JSONB NOT NULL,
    winning_proposal_id UUID,
    ended_at TIMESTAMP WITH TIME ZONE,
    blockchain_creation_transaction_id VARCHAR(255) NOT NULL,
    blockchain_end_transaction_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_auction_end_date CHECK (
        (settings->>'endDate')::timestamp > NOW()
        OR status != 'active'
    ),
    CONSTRAINT check_ended_at_when_ended CHECK (
        (status = 'ended' AND ended_at IS NOT NULL)
        OR status != 'ended'
    )
);

-- Create auction_proposals table
CREATE TABLE IF NOT EXISTS auction_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES swap_auctions(id) ON DELETE CASCADE,
    proposer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    proposal_type VARCHAR(20) NOT NULL CHECK (proposal_type IN ('booking', 'cash')),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    cash_offer JSONB,
    message TEXT,
    conditions TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'selected', 'rejected')),
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    blockchain_transaction_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_booking_proposal_has_booking CHECK (
        (proposal_type = 'booking' AND booking_id IS NOT NULL)
        OR proposal_type != 'booking'
    ),
    CONSTRAINT check_cash_proposal_has_offer CHECK (
        (proposal_type = 'cash' AND cash_offer IS NOT NULL)
        OR proposal_type != 'cash'
    ),
    CONSTRAINT check_cash_offer_amount CHECK (
        proposal_type != 'cash' 
        OR (cash_offer->>'amount')::numeric > 0
    )
);

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swap_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
    proposal_id UUID REFERENCES auction_proposals(id) ON DELETE CASCADE,
    payer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    escrow_id UUID,
    gateway_transaction_id VARCHAR(255) NOT NULL,
    platform_fee DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
    net_amount DECIMAL(12,2) NOT NULL CHECK (net_amount >= 0),
    completed_at TIMESTAMP WITH TIME ZONE,
    blockchain_transaction_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_different_payer_recipient CHECK (payer_id != recipient_id),
    CONSTRAINT check_net_amount_calculation CHECK (net_amount = amount - platform_fee),
    CONSTRAINT check_completed_at_when_completed CHECK (
        (status = 'completed' AND completed_at IS NOT NULL)
        OR status != 'completed'
    )
);

-- Create escrow_accounts table
CREATE TABLE IF NOT EXISTS escrow_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'funded', 'released', 'refunded')),
    released_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_released_at_when_released CHECK (
        (status = 'released' AND released_at IS NOT NULL)
        OR status != 'released'
    )
);

-- Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('credit_card', 'bank_transfer', 'digital_wallet')),
    display_name VARCHAR(255) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add foreign key constraint for winning_proposal_id after auction_proposals table is created
ALTER TABLE swap_auctions 
ADD CONSTRAINT fk_winning_proposal 
FOREIGN KEY (winning_proposal_id) REFERENCES auction_proposals(id) ON DELETE SET NULL;

-- Add foreign key constraint for escrow_id in payment_transactions
ALTER TABLE payment_transactions 
ADD CONSTRAINT fk_escrow_account 
FOREIGN KEY (escrow_id) REFERENCES escrow_accounts(id) ON DELETE SET NULL;

-- Create indexes for performance

-- Swaps table indexes for new columns
CREATE INDEX idx_swaps_payment_types ON swaps USING GIN (payment_types);
CREATE INDEX idx_swaps_acceptance_strategy ON swaps USING GIN (acceptance_strategy);
CREATE INDEX idx_swaps_cash_enabled ON swaps ((payment_types->>'cashPayment')) WHERE payment_types->>'cashPayment' = 'true';

-- Swap auctions indexes
CREATE INDEX idx_swap_auctions_swap_id ON swap_auctions(swap_id);
CREATE INDEX idx_swap_auctions_owner_id ON swap_auctions(owner_id);
CREATE INDEX idx_swap_auctions_status ON swap_auctions(status);
CREATE INDEX idx_swap_auctions_end_date ON swap_auctions((settings->>'endDate'));
CREATE INDEX idx_swap_auctions_active_ending_soon ON swap_auctions(status, (settings->>'endDate')) 
    WHERE status = 'active';

-- Auction proposals indexes
CREATE INDEX idx_auction_proposals_auction_id ON auction_proposals(auction_id);
CREATE INDEX idx_auction_proposals_proposer_id ON auction_proposals(proposer_id);
CREATE INDEX idx_auction_proposals_status ON auction_proposals(status);
CREATE INDEX idx_auction_proposals_type ON auction_proposals(proposal_type);
CREATE INDEX idx_auction_proposals_booking_id ON auction_proposals(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_auction_proposals_cash_amount ON auction_proposals((cash_offer->>'amount')) WHERE proposal_type = 'cash';
CREATE INDEX idx_auction_proposals_submitted_at ON auction_proposals(submitted_at);

-- Payment transactions indexes
CREATE INDEX idx_payment_transactions_swap_id ON payment_transactions(swap_id);
CREATE INDEX idx_payment_transactions_proposal_id ON payment_transactions(proposal_id);
CREATE INDEX idx_payment_transactions_payer_id ON payment_transactions(payer_id);
CREATE INDEX idx_payment_transactions_recipient_id ON payment_transactions(recipient_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_gateway_id ON payment_transactions(gateway_transaction_id);
CREATE INDEX idx_payment_transactions_blockchain_id ON payment_transactions(blockchain_transaction_id);

-- Escrow accounts indexes
CREATE INDEX idx_escrow_accounts_transaction_id ON escrow_accounts(transaction_id);
CREATE INDEX idx_escrow_accounts_status ON escrow_accounts(status);

-- Payment methods indexes
CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_type ON payment_methods(type);
CREATE INDEX idx_payment_methods_verified ON payment_methods(is_verified);

-- Composite indexes for common queries
CREATE INDEX idx_auction_proposals_auction_status ON auction_proposals(auction_id, status);
CREATE INDEX idx_auction_proposals_proposer_status ON auction_proposals(proposer_id, status);
CREATE INDEX idx_payment_transactions_user_status ON payment_transactions(payer_id, status);
CREATE INDEX idx_payment_transactions_recipient_status ON payment_transactions(recipient_id, status);

-- Create triggers to automatically update updated_at columns
CREATE TRIGGER update_swap_auctions_updated_at 
    BEFORE UPDATE ON swap_auctions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auction_proposals_updated_at 
    BEFORE UPDATE ON auction_proposals 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at 
    BEFORE UPDATE ON payment_transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escrow_accounts_updated_at 
    BEFORE UPDATE ON escrow_accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at 
    BEFORE UPDATE ON payment_methods 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE swap_auctions IS 'Stores auction configurations and state for swaps using auction acceptance strategy';
COMMENT ON TABLE auction_proposals IS 'Stores all proposals submitted to swap auctions, both booking and cash offers';
COMMENT ON TABLE payment_transactions IS 'Tracks all payment transactions for cash-based swap proposals';
COMMENT ON TABLE escrow_accounts IS 'Manages escrow accounts for secure cash transactions';
COMMENT ON TABLE payment_methods IS 'Stores user payment methods for cash transactions';

COMMENT ON COLUMN swaps.payment_types IS 'JSON object defining accepted payment types: {"bookingExchange": boolean, "cashPayment": boolean, "minimumCashAmount": number}';
COMMENT ON COLUMN swaps.acceptance_strategy IS 'JSON object defining acceptance strategy: {"type": "first_match"|"auction", "auctionEndDate": timestamp}';
COMMENT ON COLUMN swaps.cash_details IS 'JSON object with cash swap configuration when cash payments are enabled';