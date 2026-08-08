CREATE OR REPLACE FUNCTION public.owns_trade(_trade_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.trades WHERE trade_id = _trade_id AND user_id = auth.uid())
$function$;