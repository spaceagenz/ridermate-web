-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add current_fuel_range_km and distance_to_next_service_km
--            to the preferences table
-- Created: 2026-02-27
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE preferences
    ADD COLUMN IF NOT EXISTS current_fuel_range_km     numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS distance_to_next_service_km numeric DEFAULT 0;

-- Set sensible defaults for the existing 'default' row
UPDATE preferences
SET
    current_fuel_range_km      = COALESCE(current_fuel_range_km, 0),
    distance_to_next_service_km = COALESCE(distance_to_next_service_km, 0)
WHERE id = 'default';
