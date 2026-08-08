# Trade Journal Core

# MetaBrain Trader: Group 1 Implementation Prompt (Foundation & Database)



Act as a Senior Full-Stack Developer. Build the "Group 1: Foundation & Database" phase for MetaBrain Trader. This build is restricted to data architecture, user management, and the core trade entry workflow. 



### SCOPE LIMITATION (CRITICAL)

Do NOT include AI engines, learning engines, dashboard intelligence, payment integration, or social features. Build only the foundational data structures and the trade entry/viewing UI.



---



### 1. DATABASE SCHEMA & SUPABASE SETUP

Initialize the following Supabase tables with strict RLS policies (`auth.uid() = user_id`):



- **users**: `user_id` (PK), `email`, `subscription_tier` ('FREE'|'PRO'|'ELITE'), `created_at`.

- **profile_settings**: `settings_id` (PK), `user_id` (FK), `custom_prompts` (JSONB), `timezone`.

- **usage_logs**: `id` (PK), `user_id` (FK), `analysis_type` ('PRE'|'POST'), `timestamp`.

- **prompt_registry**: `id` (PK), `version_label`, `prompt_type`, `actual_prompt_text` (Text), `created_at`.

- **trades**: `trade_id` (PK), `user_id` (FK), `trade_status` ('DRAFT'|'PRE_ANALYSIS'|'PRE_ANALYZED'|'POST_DRAFT'|'POST_ANALYSIS'|'POST_ANALYZED'|'JOURNALED'|'DELETED'), `pair`, `direction`, `entry_price`, `stop_loss`, `take_profit`, `account_size`, `risk_pct`, `session`, `user_override`, `created_at`, `updated_at`.

- **screenshots**: `screenshot_id` (PK), `trade_id` (FK), `url`, `user_label`, `ai_identified_context` (JSONB), `is_primary`.

- **ai_analyses**: `analysis_id` (PK), `trade_id` (FK), `prompt_version_id` (FK), `stage` ('BLIND'|'COMPARATIVE'|'VERDICT'), `ai_output` (JSONB), `verdict` ('APPROVED'|'DISQUALIFIED'|'NEUTRAL'), `entry_score`, `coaching_notes`, `created_at`.

- **reflections**: `id` (PK), `trade_id` (FK), `content`, `is_lesson` (Boolean), `updated_at`.

- **results**: `id` (PK), `trade_id` (FK), `outcome` ('WIN'|'LOSS'|'BREAKEVEN'|'CANCELLED'), `closing_price`, `close_date`, `result_notes`.



**Security Requirements**: Enable RLS on all tables. Ensure that storage bucket `trade-screenshots` is private and restricted by RLS policies so only the authenticated trade owner can read/write their images.



---



### 2. PAGE REQUIREMENTS

- **/auth**: Implement Supabase Auth (Signup/Login/Password Reset). Upon user signup, trigger a function to insert a row into the `users` table with `subscription_tier` set to 'FREE'.

- **/dashboard**: Display a clean landing page for authenticated users. Use placeholder UI components (Cards/Charts) for future intelligence metrics.

- **/trade-creator**: Multi-step wizard. 

  - **Step 1**: Fields for Pair, Direction, Entry/SL/TP, Account Size, Risk %, Session, Notes. 

  - **Step 2**: Multiple file uploader for `trade-screenshots`. Include input fields for `user_label` per image.

  - **Step 3**: Save button that commits the trade as `DRAFT` status.

- **/trade-detail/[id]**: Read-only display of trade data. Include a dedicated section for `reflections` where users can add/edit notes (editable at any time).

- **/profile**: Display current subscription status and basic account settings.



---



### 3. UI/UX GUIDELINES

- **Edit Rules**: Enforce `trade_status == 'DRAFT'` as a condition for editing core trade information. `reflections` must be editable regardless of status.

- **Trade Status**: Default new trades to `DRAFT`.

- **Responsiveness**: Ensure the `/trade-creator` is fully mobile-optimized.



---



### 4. ACCEPTANCE CRITERIA

1. **Authentication**: User can sign up/login and navigate the app securely.

2. **Trade Creation**: User can successfully save a trade with multiple labeled screenshots.

3. **Data Persistence**: Saved data must be retrievable on the `/trade-detail` page exactly as entered.

4. **Security**: Ensure no cross-user data access is possible via RLS testing.

5. **Placeholder States**: Ensure the dashboard loads successfully with placeholder UI, confirming the app structure is sound.



**Do not implement any AI logic. This phase is exclusive

ly for data architecture, storage, and CRUD flows.**

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://meta-brain-trader.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/860d25a8-1de1-4ad5-af9e-80755a5d7d1f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
