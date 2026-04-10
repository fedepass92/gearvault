-- Migration: Rubrica contatti professionale (privati + aziende)
-- Eseguire su Supabase SQL Editor

ALTER TABLE loan_contacts ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'private';  -- 'private' o 'company'
ALTER TABLE loan_contacts ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE loan_contacts ADD COLUMN IF NOT EXISTS vat_number TEXT;      -- P.IVA
ALTER TABLE loan_contacts ADD COLUMN IF NOT EXISTS fiscal_code TEXT;     -- Codice Fiscale
ALTER TABLE loan_contacts ADD COLUMN IF NOT EXISTS sdi_code TEXT;        -- Codice SDI
ALTER TABLE loan_contacts ADD COLUMN IF NOT EXISTS pec TEXT;             -- PEC
ALTER TABLE loan_contacts ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE loan_contacts ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE loan_contacts ADD COLUMN IF NOT EXISTS zip TEXT;
ALTER TABLE loan_contacts ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE loan_contacts ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Italia';
ALTER TABLE loan_contacts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
