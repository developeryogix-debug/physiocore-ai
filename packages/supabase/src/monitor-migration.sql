-- Monitoring tables for PhysioCore AI agentic monitor system

CREATE TABLE IF NOT EXISTS public.health_checks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at  timestamptz NOT NULL DEFAULT now(),
  service     text NOT NULL,
  status      text NOT NULL CHECK (status IN ('ok', 'fail')),
  latency_ms  integer NOT NULL,
  error_msg   text,
  diagnosis_json jsonb
);

CREATE INDEX IF NOT EXISTS health_checks_service_time ON public.health_checks (service, checked_at DESC);
CREATE INDEX IF NOT EXISTS health_checks_status ON public.health_checks (status, checked_at DESC);

-- Service role only — no user RLS needed (server-side only)
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.health_checks
  USING (false);  -- blocks all anon/user access; service role bypasses RLS

CREATE TABLE IF NOT EXISTS public.alert_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at       timestamptz NOT NULL DEFAULT now(),
  service       text NOT NULL,
  severity      text NOT NULL,
  email_subject text NOT NULL
);

CREATE INDEX IF NOT EXISTS alert_log_service_time ON public.alert_log (service, sent_at DESC);

ALTER TABLE public.alert_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.alert_log
  USING (false);

CREATE TABLE IF NOT EXISTS public.cost_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date                  date NOT NULL UNIQUE,
  daily_spend_usd       numeric(10,6) NOT NULL,
  session_count         integer NOT NULL DEFAULT 0,
  avg_cost_per_session  numeric(10,6) NOT NULL DEFAULT 0
);

ALTER TABLE public.cost_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.cost_log
  USING (false);
