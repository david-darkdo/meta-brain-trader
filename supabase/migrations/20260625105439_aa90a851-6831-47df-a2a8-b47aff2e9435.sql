
-- Fix mutable search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Restrict EXECUTE on SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.owns_trade(uuid) FROM PUBLIC, anon;
-- owns_trade must be callable by authenticated users (used inside RLS via auth.uid())
GRANT EXECUTE ON FUNCTION public.owns_trade(uuid) TO authenticated;
