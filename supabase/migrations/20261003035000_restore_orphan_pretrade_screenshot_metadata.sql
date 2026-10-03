-- Restore chart evidence metadata for files already present in trade-screenshots.
WITH candidates AS (
  SELECT o.name,
    split_part(o.name,'/',1)::uuid AS user_id,
    split_part(o.name,'/',2)::uuid AS trade_id,
    o.created_at,
    row_number() OVER (
      PARTITION BY split_part(o.name,'/',2)
      ORDER BY o.created_at,o.name
    )=1 AS is_primary
  FROM storage.objects o
  JOIN public.trades t
    ON t.trade_id::text=split_part(o.name,'/',2)
   AND t.user_id::text=split_part(o.name,'/',1)
  LEFT JOIN public.screenshots s
    ON s.trade_id=t.trade_id AND s.url=o.name
  WHERE o.bucket_id='trade-screenshots'
    AND s.screenshot_id IS NULL
    AND t.trade_status IN ('PRE_ANALYSIS','PRE_ANALYZED','POST_ANALYSIS','POST_ANALYZED','JOURNALED')
)
INSERT INTO public.screenshots(trade_id,url,user_label,is_primary,shot_type,analysis_phase,created_at)
SELECT trade_id,name,regexp_replace(name,'^.*/',''),is_primary,'ENTRY'::public.screenshot_shot_type,'PRE',created_at
FROM candidates
ON CONFLICT DO NOTHING;