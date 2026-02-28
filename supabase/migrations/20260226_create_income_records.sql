-- Income Records table for Ridermate
-- Run this in your Supabase SQL editor at:
-- https://supabase.com/dashboard/project/pqvcgarxlgpjhtfmzioo/sql/new

CREATE TABLE IF NOT EXISTS income_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE NOT NULL,
  income_type   TEXT NOT NULL CHECK (income_type IN ('main', 'side')),

  -- Main Income fields (Uber / PickMe)
  app             TEXT,
  start_km        NUMERIC,
  end_km          NUMERIC,
  total_distance  NUMERIC,
  daily_earning   NUMERIC,
  cash_on_hand    NUMERIC,
  wallet_balance  NUMERIC,
  fuel_expense    NUMERIC,

  -- Side Hustle fields
  side_category   TEXT,
  client          TEXT,
  note            TEXT,
  amount          NUMERIC,

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE income_records;

-- Index for fast date queries
CREATE INDEX IF NOT EXISTS idx_income_records_date ON income_records(date);

-- Row Level Security (RLS) - Enable if using auth, disable for open access
-- ALTER TABLE income_records ENABLE ROW LEVEL SECURITY;
