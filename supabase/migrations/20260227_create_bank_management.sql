-- ═══════════════════════════════════════════════════════════════════
-- BANK MANAGEMENT MODULE — Ridermate
-- Migration: 20260227_create_bank_management
-- Tables: banks, bank_transfers
-- ═══════════════════════════════════════════════════════════════════

-- BANKS table
CREATE TABLE IF NOT EXISTS banks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    account_type text NOT NULL CHECK (account_type IN ('daily_use','savings','liability','emergency','wallet','cash')),
    starting_balance numeric NOT NULL DEFAULT 0,
    current_balance  numeric NOT NULL DEFAULT 0,
    logo_url         text,
    color            text,
    is_system        boolean NOT NULL DEFAULT false,
    is_active        boolean NOT NULL DEFAULT true,
    sort_order       integer NOT NULL DEFAULT 0,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_banks" ON banks FOR ALL USING (true) WITH CHECK (true);

-- BANK TRANSFERS table
CREATE TABLE IF NOT EXISTS bank_transfers (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_bank_id  uuid REFERENCES banks(id) ON DELETE SET NULL,
    to_bank_id    uuid REFERENCES banks(id) ON DELETE SET NULL,
    amount        numeric NOT NULL,
    service_charge numeric NOT NULL DEFAULT 0,
    note          text,
    transfer_date date NOT NULL DEFAULT CURRENT_DATE,
    created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bank_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_bank_transfers" ON bank_transfers FOR ALL USING (true) WITH CHECK (true);

-- Seed the 5 required system accounts
INSERT INTO banks (name, account_type, starting_balance, current_balance, color, is_system, sort_order) VALUES
  ('ComBank',       'daily_use', 0, 0, '#4A9FD4', true, 1),
  ('FriMi',         'liability', 0, 0, '#7B74FF', true, 2),
  ('Sampath',       'savings',   0, 0, '#1DB98A', true, 3),
  ('Uber Wallet',   'wallet',    0, 0, '#E8854A', true, 4),
  ('Cash on Hand',  'cash',      0, 0, '#D4A843', true, 5)
ON CONFLICT DO NOTHING;
