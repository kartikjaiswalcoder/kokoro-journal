CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text, avatar_url text, email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own profile select" ON public.profiles;
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, email)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url', NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  entry_date date NOT NULL,
  content text NOT NULL DEFAULT '',
  mood text, ai_summary text, ai_summary_created_at timestamptz,
  photos text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date),
  CONSTRAINT journal_entries_photos_max2 CHECK (coalesce(array_length(photos, 1), 0) <= 2)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own entries" ON public.journal_entries;
CREATE POLICY "own entries" ON public.journal_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.app_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  custom_heading text,
  longest_streak int NOT NULL DEFAULT 0,
  streak_days text[] NOT NULL DEFAULT '{}',
  reminder_time text, reminder_timezone text,
  reminder_prompt_dismissed boolean NOT NULL DEFAULT false,
  reminder_sent_on date, reminder_missed_sent_on date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_reminder_time_format CHECK (reminder_time IS NULL OR reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own settings" ON public.app_settings;
CREATE POLICY "own settings" ON public.app_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.mood_playlists (
 user_id uuid NOT NULL,
 mood text NOT NULL CHECK (mood IN ('happy','excited','calm','okay','sad','anxious')),
 songs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(songs) = 'array'),
 selected_ids text[] NOT NULL DEFAULT '{}',
 playback_mode text NOT NULL DEFAULT 'random' CHECK (playback_mode IN ('selected','ordered','random')),
 exclude_defaults boolean NOT NULL DEFAULT false,
 PRIMARY KEY (user_id,mood)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.mood_playlists TO authenticated;
GRANT ALL ON public.mood_playlists TO service_role;
ALTER TABLE public.mood_playlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own mood playlists" ON public.mood_playlists;
CREATE POLICY "Own mood playlists" ON public.mood_playlists FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL, auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users add own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users remove own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users view own push subscriptions" ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users add own push subscriptions" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own push subscriptions" ON public.push_subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users remove own push subscriptions" ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions(user_id);

DROP POLICY IF EXISTS "Users view own journal photos" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own journal photos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own journal photos" ON storage.objects;
CREATE POLICY "Users view own journal photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'journal-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users upload own journal photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'journal-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own journal photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'journal-photos' AND (storage.foldername(name))[1] = auth.uid()::text);