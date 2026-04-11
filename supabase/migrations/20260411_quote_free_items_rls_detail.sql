-- Migration: RLS per quote_free_items + campo detail
-- Eseguire su Supabase SQL Editor

-- Abilita RLS sulla tabella
ALTER TABLE quote_free_items ENABLE ROW LEVEL SECURITY;

-- Policy: gli utenti autenticati possono fare tutto (stesse policy di quote_items)
CREATE POLICY "Users can view quote_free_items" ON quote_free_items
  FOR SELECT USING (true);

CREATE POLICY "Users can insert quote_free_items" ON quote_free_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update quote_free_items" ON quote_free_items
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete quote_free_items" ON quote_free_items
  FOR DELETE USING (true);

-- Campo sottotesto/dettaglio per ogni voce
ALTER TABLE quote_free_items ADD COLUMN IF NOT EXISTS detail TEXT;
