-- GearVault – Brain Digital
-- Run this in the Supabase SQL Editor

-- ─── TABLES ──────────────────────────────────────────────────────────────────

CREATE TABLE equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT UNIQUE,
  category TEXT, -- 'camera' | 'lens' | 'drone' | 'audio' | 'lighting' | 'support' | 'accessory' | 'altro'
  purchase_date DATE,
  purchase_price DECIMAL(10,2),
  market_value DECIMAL(10,2),
  insured_value DECIMAL(10,2),
  condition TEXT DEFAULT 'active', -- 'active' | 'repair' | 'retired'
  battery_status TEXT DEFAULT 'na', -- 'charged' | 'low' | 'charging' | 'na'
  last_checked_at TIMESTAMPTZ,
  location TEXT DEFAULT 'studio', -- 'campo' | 'studio' | 'prestito'
  useful_life_years INTEGER,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  job_date DATE,
  location TEXT,
  notes TEXT,
  status TEXT DEFAULT 'planned', -- 'planned' | 'out' | 'returned' | 'incomplete'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE set_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id UUID REFERENCES sets(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id),
  checked_out_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  status TEXT DEFAULT 'planned' -- 'planned' | 'out' | 'returned'
);

CREATE TABLE kits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE kit_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kit_id UUID REFERENCES kits(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (kit_id, equipment_id)
);

CREATE TABLE cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE case_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (case_id, equipment_id)
);

-- A case can contain one or more kits
CREATE TABLE case_kits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  kit_id UUID REFERENCES kits(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (case_id, kit_id)
);

CREATE TABLE movement_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id UUID REFERENCES sets(id) ON DELETE SET NULL,
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  set_item_id UUID REFERENCES set_items(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'checkout' | 'checkin'
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

CREATE TABLE set_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id UUID REFERENCES sets(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'pre' | 'post'
  note TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
  value DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── AUTO-CREATE PROFILE ON SIGNUP ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    CASE WHEN (SELECT COUNT(*) FROM profiles) = 0 THEN 'admin' ELSE 'operator' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── UPDATED_AT TRIGGER ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_equipment_updated_at
  BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kits_updated_at
  BEFORE UPDATE ON kits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view equipment" ON equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert equipment" ON equipment FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin can update equipment" ON equipment FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin can delete equipment" ON equipment FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Authenticated can manage sets" ON sets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage set_items" ON set_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage cases" ON cases FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage case_items" ON case_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage case_kits" ON case_kits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage kits" ON kits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage kit_items" ON kit_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can view movement_log" ON movement_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert movement_log" ON movement_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can manage set_notes" ON set_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage price_history" ON price_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admin can update any profile" ON profiles FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── STORAGE BUCKET ──────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-photos', 'equipment-photos', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Public read access for equipment photos" ON storage.objects FOR SELECT USING (bucket_id = 'equipment-photos');
CREATE POLICY "Authenticated can upload equipment photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'equipment-photos');
CREATE POLICY "Authenticated can update equipment photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'equipment-photos');
CREATE POLICY "Authenticated can delete equipment photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'equipment-photos');

-- ─── MIGRATION (run on existing DB) ──────────────────────────────────────────
-- Run these ALTER statements on your existing Supabase database:
--
-- ALTER TABLE equipment ADD COLUMN IF NOT EXISTS insured_value DECIMAL(10,2);
-- ALTER TABLE equipment ADD COLUMN IF NOT EXISTS battery_status TEXT DEFAULT 'na';
-- ALTER TABLE equipment ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
-- ALTER TABLE equipment ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'studio';
-- ALTER TABLE equipment ADD COLUMN IF NOT EXISTS useful_life_years INTEGER;
--
-- CREATE TABLE IF NOT EXISTS kits (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   name TEXT NOT NULL,
--   description TEXT,
--   created_at TIMESTAMPTZ DEFAULT now(),
--   updated_at TIMESTAMPTZ DEFAULT now()
-- );
-- CREATE TABLE IF NOT EXISTS kit_items (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   kit_id UUID REFERENCES kits(id) ON DELETE CASCADE,
--   equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
--   added_at TIMESTAMPTZ DEFAULT now(),
--   UNIQUE (kit_id, equipment_id)
-- );
-- CREATE TABLE IF NOT EXISTS case_kits (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
--   kit_id UUID REFERENCES kits(id) ON DELETE CASCADE,
--   added_at TIMESTAMPTZ DEFAULT now(),
--   UNIQUE (case_id, kit_id)
-- );
-- CREATE TABLE IF NOT EXISTS price_history (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
--   value DECIMAL(10,2) NOT NULL,
--   date DATE NOT NULL DEFAULT CURRENT_DATE,
--   note TEXT,
--   created_at TIMESTAMPTZ DEFAULT now()
-- );
-- ALTER TABLE kits ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE kit_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE case_kits ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Authenticated can manage kits" ON kits FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "Authenticated can manage kit_items" ON kit_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "Authenticated can manage case_kits" ON case_kits FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "Authenticated can manage price_history" ON price_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE TRIGGER update_kits_updated_at BEFORE UPDATE ON kits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--
-- ── v3 migrations (run these in the Supabase SQL Editor) ─────────────────────
--
-- 1. App settings table (required for Impostazioni page to save)
-- CREATE TABLE IF NOT EXISTS app_settings (
--   key TEXT PRIMARY KEY,
--   value JSONB,
--   updated_at TIMESTAMPTZ DEFAULT now()
-- );
-- ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Admin can manage app_settings" ON app_settings
--   FOR ALL TO authenticated
--   USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
--   WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
--
-- 2. Settings storage bucket (for logo upload)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('settings', 'settings', true) ON CONFLICT DO NOTHING;
-- CREATE POLICY "Public read for settings" ON storage.objects FOR SELECT USING (bucket_id = 'settings');
-- CREATE POLICY "Admin can upload to settings" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'settings');
-- CREATE POLICY "Admin can update settings objects" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'settings');
--
-- 3. end_date column on sets (for multi-day sets)
-- ALTER TABLE sets ADD COLUMN IF NOT EXISTS end_date DATE;
--
-- 4. quotes and quote_items tables (for Preventivi page)
-- CREATE TABLE IF NOT EXISTS quotes (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
--   title TEXT NOT NULL,
--   client_name TEXT,
--   client_email TEXT,
--   event_date DATE,
--   notes TEXT,
--   status TEXT DEFAULT 'draft', -- 'draft' | 'sent' | 'confirmed' | 'archived'
--   created_at TIMESTAMPTZ DEFAULT now(),
--   updated_at TIMESTAMPTZ DEFAULT now()
-- );
-- CREATE TABLE IF NOT EXISTS quote_items (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
--   item_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
--   quantity INTEGER DEFAULT 1,
--   daily_rate DECIMAL(10,2),
--   notes TEXT,
--   created_at TIMESTAMPTZ DEFAULT now()
-- );
-- ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Authenticated can manage quotes" ON quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "Authenticated can manage quote_items" ON quote_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
