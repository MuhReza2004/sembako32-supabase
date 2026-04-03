-- Update Script for Sembako32 Database Schema
-- Run this SQL in your Supabase SQL Editor to apply the latest changes
-- This script adds sequences for atomic numbering and updates generation functions

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create sequences for atomic numbering
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;
CREATE SEQUENCE IF NOT EXISTS npb_seq START 1;
CREATE SEQUENCE IF NOT EXISTS do_seq START 1;
CREATE SEQUENCE IF NOT EXISTS tanda_terima_seq START 1;

-- Update generation functions to use sequences
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year INTEGER;
  current_month INTEGER;
  next_num INTEGER;
  invoice_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());
  current_month := EXTRACT(MONTH FROM NOW());

  -- Use sequence for atomic numbering
  next_num := nextval('invoice_seq');

  invoice_number := 'INV/S32/' || current_year || '/' || LPAD(current_month::TEXT, 2, '0') || '/' || LPAD(next_num::TEXT, 4, '0');

  RETURN invoice_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_npb_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year INTEGER;
  current_month INTEGER;
  current_day INTEGER;
  next_num INTEGER;
  npb_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());
  current_month := EXTRACT(MONTH FROM NOW());
  current_day := EXTRACT(DAY FROM NOW());

  -- Use sequence for atomic numbering
  next_num := nextval('npb_seq');

  npb_number := 'NPB/G001/' || current_year || '/' || LPAD(current_month::TEXT, 2, '0') || '/' || LPAD(current_day::TEXT, 2, '0') || '/' || LPAD(next_num::TEXT, 4, '0');

  RETURN npb_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_do_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year INTEGER;
  current_month INTEGER;
  next_num INTEGER;
  do_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());
  current_month := EXTRACT(MONTH FROM NOW());

  -- Use sequence for atomic numbering
  next_num := nextval('do_seq');

  do_number := 'DO/S32/' || current_year || '/' || LPAD(current_month::TEXT, 2, '0') || '/' || LPAD(next_num::TEXT, 4, '0');

  RETURN do_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_tanda_terima_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year INTEGER;
  current_month INTEGER;
  next_num INTEGER;
  tanda_terima_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());
  current_month := EXTRACT(MONTH FROM NOW());

  -- Use sequence for atomic numbering
  next_num := nextval('tanda_terima_seq');

  tanda_terima_number := 'TT/S32/' || current_year || '/' || LPAD(current_month::TEXT, 2, '0') || '/' || LPAD(next_num::TEXT, 4, '0');

  RETURN tanda_terima_number;
END;
$$;

-- Set sequences to current max values + 1 to avoid conflicts
-- Handle cases where fields might be null or empty
SELECT setval('invoice_seq', COALESCE((SELECT MAX(CAST(NULLIF(SPLIT_PART(no_invoice, '/', 5), '') AS INTEGER)) FROM penjualan WHERE no_invoice IS NOT NULL AND no_invoice != ''), 0) + 1);
SELECT setval('npb_seq', COALESCE((SELECT MAX(CAST(NULLIF(SPLIT_PART(no_npb, '/', 5), '') AS INTEGER)) FROM penjualan WHERE no_npb IS NOT NULL AND no_npb != ''), 0) + 1);
SELECT setval('do_seq', COALESCE((SELECT MAX(CAST(NULLIF(SPLIT_PART(no_do, '/', 4), '') AS INTEGER)) FROM penjualan WHERE no_do IS NOT NULL AND no_do != ''), 0) + 1);
SELECT setval('tanda_terima_seq', COALESCE((SELECT MAX(CAST(NULLIF(SPLIT_PART(no_tanda_terima, '/', 5), '') AS INTEGER)) FROM penjualan WHERE no_tanda_terima IS NOT NULL AND no_tanda_terima != ''), 0) + 1);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_npb_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_do_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_tanda_terima_number() TO authenticated;

-- Note: This script assumes your existing tables and data are intact.
-- If you need to run the full schema from scratch, use supabase-schema.sql instead.