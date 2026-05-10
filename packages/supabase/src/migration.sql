-- PhysioCore AI — Supabase Migration v2
-- Run this in Supabase Dashboard → SQL Editor
-- Order matters: profiles before outcomes/consents (FK deps)

-- ─── profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  full_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'patient'
              CHECK (role IN ('patient', 'clinician', 'admin')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"    ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert_own"    ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own"    ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "profiles_admin_all"     ON public.profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- ─── outcomes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outcomes (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('psfs', 'nprs', 'groc', 'phq4')),
  score        NUMERIC NOT NULL,
  metadata     JSONB,
  recorded_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outcomes_select_own"    ON public.outcomes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "outcomes_insert_own"    ON public.outcomes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "outcomes_clinician_read" ON public.outcomes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('clinician','admin')));

-- ─── consents ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consents (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  version    TEXT NOT NULL DEFAULT '1.0',
  full_name  TEXT NOT NULL,
  signed_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ip_hash    TEXT
);

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consents_select_own"   ON public.consents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "consents_insert_own"   ON public.consents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "consents_admin_read"   ON public.consents FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- ─── sessions — extend existing table ────────────────────────────────────────
-- Skip if sessions table doesn't exist yet; create it fresh instead.
CREATE TABLE IF NOT EXISTS public.sessions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exercise     TEXT,
  date         DATE DEFAULT CURRENT_DATE,
  reps         INTEGER DEFAULT 0,
  form_score   NUMERIC,
  duration_min INTEGER,
  fhir_json    JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add columns if table already existed without them
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS exercise      TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS date          DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS reps          INTEGER DEFAULT 0;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS duration_min  INTEGER;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS fhir_json     JSONB;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select_own"     ON public.sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sessions_insert_own"     ON public.sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sessions_update_own"     ON public.sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sessions_clinician_read" ON public.sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('clinician','admin')));

-- ─── user_profiles — enable RLS ──────────────────────────────────────────────
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='user_profiles' AND policyname='user_profiles_own_all'
  ) THEN
    EXECUTE 'CREATE POLICY user_profiles_own_all ON public.user_profiles FOR ALL USING (auth.uid() = id)';
  END IF;
END $$;

-- ─── Google OAuth — enable in Supabase Dashboard ────────────────────────────
-- Authentication → Providers → Google → enable + add Client ID + Secret
-- Site URL: https://app-dteam1-mmcv.vercel.app
-- Redirect URLs: https://app-dteam1-mmcv.vercel.app/**, http://localhost:5173/**
