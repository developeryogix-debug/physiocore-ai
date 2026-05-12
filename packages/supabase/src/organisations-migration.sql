-- PhysioCore AI — Multi-Tenant Organisation Migration
-- Run in Supabase SQL Editor

-- ── Core tables ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organisations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  type          text        CHECK (type IN ('clinic','gym','yoga_studio','wellness_retreat')),
  slug          text        UNIQUE NOT NULL,
  logo_url      text,
  contact_email text,
  country       text        DEFAULT 'SG',
  created_by    uuid        REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        REFERENCES organisations(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES auth.users(id)   ON DELETE CASCADE,
  role        text        CHECK (role IN ('org_admin','clinician','trainer','patient')),
  invited_by  uuid        REFERENCES auth.users(id),
  joined_at   timestamptz DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE TABLE IF NOT EXISTS clinician_patients (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id   uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       uuid        REFERENCES organisations(id),
  assigned_at  timestamptz DEFAULT now(),
  status       text        DEFAULT 'active',
  UNIQUE(clinician_id, patient_id)
);

CREATE TABLE IF NOT EXISTS invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        REFERENCES organisations(id) ON DELETE CASCADE,
  invited_by  uuid        REFERENCES auth.users(id),
  email       text        NOT NULL,
  role        text        CHECK (role IN ('org_admin','clinician','trainer','patient')),
  token       text        UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at  timestamptz DEFAULT now() + interval '7 days',
  used_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- ── Profile columns ───────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role   text DEFAULT 'patient';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE organisations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinician_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites            ENABLE ROW LEVEL SECURITY;

-- organisations: members can read their own org; admins can read all
CREATE POLICY "org_select" ON organisations FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM org_members WHERE org_id = organisations.id)
  OR auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'admin')
);

CREATE POLICY "org_insert" ON organisations FOR INSERT WITH CHECK (
  auth.uid() = created_by
  OR auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'admin')
);

-- org_members: members can read their own org's members
CREATE POLICY "org_members_select" ON org_members FOR SELECT USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  OR auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'admin')
);

CREATE POLICY "org_members_insert" ON org_members FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM org_members WHERE org_id = org_members.org_id AND role = 'org_admin'
  )
  OR auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'admin')
);

-- clinician_patients: clinician sees their own patients; org_admin sees all in org
CREATE POLICY "cp_select" ON clinician_patients FOR SELECT USING (
  clinician_id = auth.uid()
  OR patient_id = auth.uid()
  OR auth.uid() IN (
    SELECT user_id FROM org_members
    WHERE org_id = clinician_patients.org_id AND role IN ('org_admin','admin')
  )
  OR auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'admin')
);

CREATE POLICY "cp_insert" ON clinician_patients FOR INSERT WITH CHECK (
  clinician_id = auth.uid()
  OR auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('admin','org_admin'))
);

-- invites: org_admin can create; anyone can read by token (for accept flow)
CREATE POLICY "invite_select" ON invites FOR SELECT USING (true);

CREATE POLICY "invite_insert" ON invites FOR INSERT WITH CHECK (
  invited_by = auth.uid()
  OR auth.uid() IN (SELECT user_id FROM profiles WHERE role IN ('admin','org_admin'))
);

CREATE POLICY "invite_update" ON invites FOR UPDATE USING (true);
