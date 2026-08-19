-- Ensure trade-screenshots bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-screenshots', 'trade-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload trade screenshots'
  ) THEN
    CREATE POLICY "Authenticated users can upload trade screenshots"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can read trade screenshots'
  ) THEN
    CREATE POLICY "Authenticated users can read trade screenshots"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can delete trade screenshots'
  ) THEN
    CREATE POLICY "Authenticated users can delete trade screenshots"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
