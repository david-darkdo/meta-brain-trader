
ALTER TABLE public.strategy_profiles
  ADD COLUMN IF NOT EXISTS system_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS core_strategy jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS entry_confirmations jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_engine jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS filter_engine jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS psychology_engine jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS learning_engine jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS education_engine jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS community_engine jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS investor_engine jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.strategy_profiles ALTER COLUMN name DROP NOT NULL;

-- Seed defaults for existing rows that have empty sections
UPDATE public.strategy_profiles SET
  system_profile = CASE WHEN system_profile = '{}'::jsonb THEN jsonb_build_object(
    'strategy_name', COALESCE(name, 'FX David Darkdo'),
    'trading_style', 'Swing + Day Hybrid',
    'trade_duration', 'Hours to Days',
    'instruments', ARRAY['EURUSD','GBPUSD','XAUUSD'],
    'risk_per_trade', 0.5,
    'max_trades_week', 2,
    'max_daily_loss', 2,
    'minimum_rr', 3,
    'trailing_start_rr', 2
  ) ELSE system_profile END,
  core_strategy = CASE WHEN core_strategy = '{}'::jsonb THEN jsonb_build_object(
    'primary_strategy', 'Master Break & Retest',
    'secondary_strategy', 'Liquidity Sweep + OB',
    'bias_timeframes', ARRAY['1D','4H'],
    'entry_timeframes', ARRAY['1H','30M','15M'],
    'aoi_rules', 'Mark prior swing highs/lows and HTF order blocks',
    'break_rules', 'Body close beyond level on entry TF',
    'retest_rules', 'Wait for retest of broken level with rejection',
    'structure_rules', 'Respect HTF structure; no counter-trend entries',
    'displacement_rules', 'Require strong impulsive candle on break',
    'liquidity_rules', 'Hunt obvious equal highs/lows before entry',
    'orderblock_rules', 'Use last opposing OB before displacement',
    'confirmation_rules', 'Minimum 3 confirmations required',
    'consecutive_candle_rules', 'No more than 2 same-direction candles before entry'
  ) ELSE core_strategy END,
  entry_confirmations = CASE WHEN entry_confirmations = '{}'::jsonb THEN jsonb_build_object(
    'confirm_break_retest', true,
    'confirm_head_shoulders', false,
    'confirm_engulfing', true,
    'confirm_doji', false,
    'confirm_ema_rejection', true,
    'confirm_ema_alignment', true,
    'confirm_structure_shift', true,
    'confirm_liquidity_sweep', true,
    'confirm_orderblock', true,
    'confirm_bos', true,
    'confirm_choch', true,
    'confirm_mss', false,
    'minimum_confirmations', 3
  ) ELSE entry_confirmations END,
  risk_engine = CASE WHEN risk_engine = '{}'::jsonb THEN jsonb_build_object(
    'risk_per_trade', 0.5,
    'max_daily_loss', 2,
    'max_weekly_trades', 2,
    'minimum_rr', 3,
    'trailing_rr', 2,
    'position_sizing_method', 'FIXED_PERCENT',
    'volatility_adjustment', false,
    'news_protection', true
  ) ELSE risk_engine END,
  filter_engine = CASE WHEN filter_engine = '{}'::jsonb THEN jsonb_build_object(
    'allow_friday', false,
    'trading_window_start', '07:00',
    'trading_window_end', '16:00',
    'high_impact_news_filter', true,
    'spread_filter', true,
    'session_filter', 'LONDON_NY',
    'weekend_filter', true,
    'volatility_filter', true
  ) ELSE filter_engine END,
  psychology_engine = CASE WHEN psychology_engine = '{}'::jsonb THEN jsonb_build_object(
    'pretrade_prayer', '',
    'pretrade_affirmation', 'I trade my plan with patience and discipline.',
    'reset_protocol', 'Step away 30 min after any loss.',
    'fomo_detection', true,
    'revenge_detection', true,
    'fear_detection', true,
    'discipline_reminders', true
  ) ELSE psychology_engine END,
  learning_engine = CASE WHEN learning_engine = '{}'::jsonb THEN jsonb_build_object(
    'lookback_trades', 24,
    'repeated_mistake_threshold', 2,
    'pattern_promotion_threshold', 70,
    'pattern_ban_threshold', 30,
    'auto_lesson_extraction', true
  ) ELSE learning_engine END,
  education_engine = CASE WHEN education_engine = '{}'::jsonb THEN jsonb_build_object(
    'challenge_weak_analysis', true,
    'explain_market_narrative', true,
    'explain_institutional_logic', true,
    'compare_ai_vs_user', true
  ) ELSE education_engine END,
  community_engine = CASE WHEN community_engine = '{}'::jsonb THEN jsonb_build_object(
    'allow_journal_sharing', false,
    'allow_ai_summary', false,
    'allow_screenshot_sharing', false,
    'allow_discord_export', false,
    'allow_public_profiles', false,
    'allow_comments', false,
    'allow_likes', false
  ) ELSE community_engine END,
  investor_engine = CASE WHEN investor_engine = '{}'::jsonb THEN jsonb_build_object(
    'master_account_enabled', true,
    'mirror_trades', true,
    'auto_performance_updates', true,
    'auto_equity_updates', true,
    'investor_dashboard_enabled', true,
    'risk_source', 'MASTER_ACCOUNT_ONLY'
  ) ELSE investor_engine END;
