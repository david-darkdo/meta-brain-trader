REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snapshot_reflection_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snapshot_strategy_os_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;