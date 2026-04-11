-- Migration: Preventivo Libero (voci personalizzate + IVA configurabile)
-- Eseguire su Supabase SQL Editor

-- Tipo preventivo: 'rental' (default, esistente) o 'free' (libero)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_type TEXT DEFAULT 'rental';

-- Aliquota IVA configurabile per preventivo
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS vat_rate NUMERIC DEFAULT 22;

-- Se i prezzi sono IVA inclusa
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS prices_include_vat BOOLEAN DEFAULT false;

-- Tabella voci libere per preventivi di tipo 'free'
CREATE TABLE IF NOT EXISTS quote_free_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
