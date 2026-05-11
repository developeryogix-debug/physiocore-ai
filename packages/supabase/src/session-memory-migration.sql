-- AI session memory tables

CREATE TABLE IF NOT EXISTS public.session_summaries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date                 timestamptz NOT NULL DEFAULT now(),
  exercise             text NOT NULL,
  reps                 integer NOT NULL DEFAULT 0,
  avg_score            integer NOT NULL DEFAULT 0,
  top_deviation        text,
  ai_feedback_summary  text,
  pain_before          integer,
  pain_after           integer
);

CREATE INDEX IF NOT EXISTS session_summaries_user_date
  ON public.session_summaries (user_id, date DESC);

ALTER TABLE public.session_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own summaries" ON public.session_summaries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL,
  page       text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_user_page_time
  ON public.chat_messages (user_id, page, created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chat" ON public.chat_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
