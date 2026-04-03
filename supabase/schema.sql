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
  body TEXT,
  photo_url TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_notes ENABLE ROW LEVEL SECURITY;

-- equipment: all authenticated can SELECT; only admin can INSERT/UPDATE/DELETE
CREATE POLICY "Authenticated can view equipment"
  ON equipment FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert equipment"
  ON equipment FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update equipment"
  ON equipment FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can delete equipment"
  ON equipment FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- sets: all authenticated can CRUD
CREATE POLICY "Authenticated can manage sets"
  ON sets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- set_items: all authenticated can CRUD
CREATE POLICY "Authenticated can manage set_items"
  ON set_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- cases: all authenticated can CRUD
CREATE POLICY "Authenticated can manage cases"
  ON cases FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- case_items: all authenticated can CRUD
CREATE POLICY "Authenticated can manage case_items"
  ON case_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- movement_log: all authenticated can read; insert on action
CREATE POLICY "Authenticated can view movement_log"
  ON movement_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert movement_log"
  ON movement_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- set_notes: all authenticated can CRUD
CREATE POLICY "Authenticated can manage set_notes"
  ON set_notes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- profiles: authenticated can view all; each user can update their own
CREATE POLICY "Authenticated can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admin can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── STORAGE BUCKET ──────────────────────────────────────────────────────────
-- Run in Supabase Dashboard > Storage, or via SQL:

INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-photos', 'equipment-photos', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Public read access for equipment photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'equipment-photos');

CREATE POLICY "Authenticated can upload equipment photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'equipment-photos');

CREATE POLICY "Authenticated can update equipment photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'equipment-photos');

CREATE POLICY "Authenticated can delete equipment photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'equipment-photos');

-- ─── MIGRATION (run on existing DB) ─────────────────────────────────────────
-- ALTER TABLE equipment ADD COLUMN IF NOT EXISTS insured_value DECIMAL(10,2);
-- ALTER TABLE equipment ADD COLUMN IF NOT EXISTS battery_status TEXT DEFAULT 'na';
-- ALTER TABLE equipment ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
