-- ============================================================
-- BUILD 1F: PERSONAL JOURNAL NOTES MIGRATION
-- Dedicated personal notebook storage isolated per authenticated user
-- ============================================================

CREATE TABLE IF NOT EXISTS public.journal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying user notes ordered by date
CREATE INDEX IF NOT EXISTS idx_journal_notes_user_created 
ON public.journal_notes (user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.journal_notes ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy: User can only read own notes
DROP POLICY IF EXISTS "journal_notes_select_owner" ON public.journal_notes;
CREATE POLICY "journal_notes_select_owner"
ON public.journal_notes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2. INSERT Policy: User can only create own notes
DROP POLICY IF EXISTS "journal_notes_insert_owner" ON public.journal_notes;
CREATE POLICY "journal_notes_insert_owner"
ON public.journal_notes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. UPDATE Policy: User can only update own notes
DROP POLICY IF EXISTS "journal_notes_update_owner" ON public.journal_notes;
CREATE POLICY "journal_notes_update_owner"
ON public.journal_notes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. DELETE Policy: User can only delete own notes
DROP POLICY IF EXISTS "journal_notes_delete_owner" ON public.journal_notes;
CREATE POLICY "journal_notes_delete_owner"
ON public.journal_notes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_journal_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_notes_updated_at ON public.journal_notes;
CREATE TRIGGER trg_journal_notes_updated_at
BEFORE UPDATE ON public.journal_notes
FOR EACH ROW
EXECUTE FUNCTION public.set_journal_notes_updated_at();
