-- monitoring-agents-migration.sql
-- Run once in Supabase SQL Editor before deploying daily-monitor agent.
-- Tables: monitoring_alerts

CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type  text        NOT NULL CHECK (alert_type IN ('missed_sessions','pain_worsening','form_improving','form_declining')),
  message     text,
  sent_to     text        NOT NULL DEFAULT 'none' CHECK (sent_to IN ('patient','clinician','none')),
  severity    text        NOT NULL DEFAULT 'info'  CHECK (severity IN ('info','warning','urgent')),
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for dedup check and clinician alert dashboard
CREATE INDEX IF NOT EXISTS monitoring_alerts_user_id_idx ON monitoring_alerts (user_id);
CREATE INDEX IF NOT EXISTS monitoring_alerts_created_at_idx ON monitoring_alerts (created_at DESC);

ALTER TABLE monitoring_alerts ENABLE ROW LEVEL SECURITY;

-- Patients can only read their own alerts
CREATE POLICY "patient_read_own" ON monitoring_alerts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role has full access (used by cron functions)
CREATE POLICY "service_role_all" ON monitoring_alerts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Clinicians can read alerts for patients in their org (via join through profiles)
CREATE POLICY "clinician_read_org_alerts" ON monitoring_alerts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p_patient
      JOIN   profiles p_clinician ON p_clinician.org_id = p_patient.org_id
      WHERE  p_patient.user_id   = monitoring_alerts.user_id
        AND  p_clinician.user_id = auth.uid()
        AND  p_clinician.role    IN ('clinician', 'admin')
    )
  );
