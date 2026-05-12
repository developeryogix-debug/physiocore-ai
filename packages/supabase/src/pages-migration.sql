-- Migration: history, outcomes, settings, trainer pages
-- Run in Supabase SQL Editor

-- ─── biometrics ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.biometrics (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_type  text NOT NULL CHECK (metric_type IN ('hr','bp_sys','bp_dia','glucose','hrv','sleep','weight')),
  value        numeric NOT NULL,
  unit         text NOT NULL,
  recorded_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biometrics_user_metric ON public.biometrics (user_id, metric_type, recorded_at DESC);
ALTER TABLE public.biometrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own biometrics" ON public.biometrics
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── trainer_sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trainer_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'New conversation',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trainer_sessions_user ON public.trainer_sessions (user_id, created_at DESC);
ALTER TABLE public.trainer_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own trainer sessions" ON public.trainer_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── trainer_messages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trainer_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.trainer_sessions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user','assistant')),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trainer_messages_session ON public.trainer_messages (session_id, created_at ASC);
ALTER TABLE public.trainer_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own trainer messages" ON public.trainer_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
