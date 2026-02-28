-- ═══════════════════════════════════════════════════════════════════════════
-- Ridermate - Liabilities Migration
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/pqvcgarxlgpjhtfmzioo/sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Liabilities Table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS liabilities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    liability_type TEXT NOT NULL DEFAULT 'loan'
        CHECK (liability_type IN ('pawning', 'finance', 'loan', 'credit_card', 'other')),
    interest_method TEXT NOT NULL DEFAULT 'flat'
        CHECK (interest_method IN ('flat', 'reducing_balance', 'none')),
    principal_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    interest_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    monthly_payment NUMERIC(12,2) NOT NULL DEFAULT 0,
    arrears_amount NUMERIC(12,2) DEFAULT 0,
    payment_day INTEGER CHECK (payment_day BETWEEN 1 AND 31),
    start_date DATE,
    end_date DATE,
    priority_percent NUMERIC(5,2) DEFAULT 0 CHECK (priority_percent BETWEEN 0 AND 100),
    priority_level TEXT DEFAULT 'medium'
        CHECK (priority_level IN ('high', 'medium', 'low')),
    note TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Liability Payments Table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS liability_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    liability_id UUID REFERENCES liabilities(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    payment_date DATE NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Row Level Security ────────────────────────────────────────────────────
ALTER TABLE liabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE liability_payments ENABLE ROW LEVEL SECURITY;

-- Allow all operations (single-user app)
CREATE POLICY "Allow all on liabilities" ON liabilities
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on liability_payments" ON liability_payments
    FOR ALL USING (true) WITH CHECK (true);

-- ─── Indexes for performance ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_liabilities_type ON liabilities(liability_type);
CREATE INDEX IF NOT EXISTS idx_liabilities_active ON liabilities(is_active);
CREATE INDEX IF NOT EXISTS idx_liability_payments_lid ON liability_payments(liability_id);
CREATE INDEX IF NOT EXISTS idx_liability_payments_date ON liability_payments(payment_date);
