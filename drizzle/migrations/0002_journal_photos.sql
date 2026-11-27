ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_entries_photos_max2 CHECK (coalesce(array_length(photos, 1), 0) <= 2);

CREATE POLICY "Users view own journal photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'journal-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own journal photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'journal-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own journal photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'journal-photos' AND (storage.foldername(name))[1] = auth.uid()::text);