ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS reminder_time text,
  ADD COLUMN IF NOT EXISTS reminder_timezone text,
  ADD COLUMN IF NOT EXISTS reminder_prompt_dismissed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_on date,
  ADD COLUMN IF NOT EXISTS reminder_missed_sent_on date;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_reminder_time_format CHECK (reminder_time IS NULL OR reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own push subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users add own push subscriptions" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own push subscriptions" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users remove own push subscriptions" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions(user_id);