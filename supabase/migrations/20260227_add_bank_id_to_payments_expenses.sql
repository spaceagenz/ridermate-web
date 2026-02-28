-- ═══════════════════════════════════════════════════════════════════
-- Ridermate — Add bank linkage to liability_payments & daily_expenses
-- Migration: 20260227_add_bank_id_to_payments_expenses
-- ═══════════════════════════════════════════════════════════════════

-- Add bank_id (FK to banks) and is_future flag to liability_payments
-- is_future = true means payment is scheduled but balance NOT yet deducted
ALTER TABLE liability_payments
  ADD COLUMN IF NOT EXISTS bank_id uuid REFERENCES banks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_future boolean NOT NULL DEFAULT false;

-- Add bank_id to daily_expenses
-- Nullable for backward compatibility with existing records
ALTER TABLE daily_expenses
  ADD COLUMN IF NOT EXISTS bank_id uuid REFERENCES banks(id) ON DELETE SET NULL;
