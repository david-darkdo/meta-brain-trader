# MetaBrain Trader — Investor / CEO Platform Rebuild Plan

## Working method

Build in small, vertical milestones. Each milestone includes the minimum database/RLS/RPC work and the corresponding UI, then tests both before moving on. Preserve current production records and existing working flows. Do not redesign unrelated screens or add speculative features. No destructive migration or table retirement without a verified replacement and explicit approval.

## Production baseline audited

- Supabase project: `jqptprskuxkhfoxsvwcl` (current Vercel production backend).
- 30 public tables; all 30 have RLS enabled.
- Existing financial foundation includes `investor_accounts`, `capital_events`, `investment_cycles`, `trade_participations`, `financial_ledger`, `withdrawal_requests`, `chart_of_accounts`, `journal_entries`, and `journal_lines`.
- Existing privileged financial RPCs include deposit intent/proof, deposit approval/activation, withdrawal request/approval/settlement, cycle creation/activation/closure, trade allocation, and reconciliation.
- Existing role model uses `user_roles`, `is_admin()`, and `is_investor()`. Admin routes already perform server/database-backed admin checks.
- Existing pre-trade and post-trade Edge Functions are active (pre-trade v13, post-trade v7).
- Current production records at audit: 13 trades, 34 screenshots, 91 AI analyses, 10 user profile rows, 3 role rows, 2 investor accounts, 4 capital events, 1 investment cycle, 6 financial-ledger events, 2 withdrawal requests, 6 journal entries and 12 journal lines. Do not reset or replace these records.
- Existing authenticated navigation has four tabs: Validator, MetaFund, Community and Profile. The root route currently redirects signed-in users to Validator and signed-out users to Auth.
- Existing MetaFund is already a functioning investor-capital workflow (deposit proof, admin review, cycle, trade participation, withdrawals). Existing Command Center is admin-gated.
- Existing Community is currently a static “Coming Soon” page, not a working community system.

## Architecture gaps against the new vision

1. **Investor / CEO separation:** Current shared navigation exposes the Validator tab to every authenticated user. The validator routes themselves need a reliable CEO/admin gate, not just a hidden link.
2. **Investor homepage:** The root route is a redirect, not a public-facing firm homepage or Proframe catalogue.
3. **Account model:** `investor_accounts` currently represents the existing normal investor account. There is no explicit account type / parent-child relationship for Main versus individually purchased Proframe accounts.
4. **Proframe catalogue and purchase:** No product catalogue, purchasable Proframe plan, order, purchase RPC or purchase lifecycle exists.
5. **Ledger attribution:** Current financial events and accounting are investor-level. Proframe requires separate records for (a) investor payment/activation fee, (b) operator's third-party prop-firm purchase and related costs, (c) participation entitlement and linked prop-firm account, (d) trade-level performance allocation, and (e) profit distributions credited to the investor's Main Account. Never book the activation payment as the prop firm's trading balance or as investor-owned withdrawable capital.
6. **Trade allocation:** `trade_participations` currently references `investor_accounts` directly and defaults to 1% risk. It does not yet identify a Proframe participation bundle / linked third-party prop-firm account or enforce separate 2% Main / 0.5% Proframe risk policies. One operator trade may generate separate, auditable performance allocations for eligible Main Account investors and Proframe participants.
7. **Profit distribution:** Existing cycle close and 70/30 settlement foundation is for the current investor capital model. Proframe cycle profit must be calculated from eligible closed trades and the applicable third-party prop-firm payout/rule constraints, then the investor's agreed share credited to their Main Account. Do not confuse activation fees, operator-paid prop-firm fees, the prop firm's notional account balance, trading P&L, and investor distributable profit.
8. **Community:** Community content, posts, lessons and announcements do not yet have a backend model.
9. **Public performance claims:** Homepage metrics must be sourced from verified, approved records and clearly distinguish historical performance from targets or projections.

## Target experience

### Investor
- Public Homepage: firm introduction, how the model works, cycle/risk explanation, available Proframes, pricing, verified performance disclosures, deposit / purchase / sign-in actions.
- MetaFund: explicit Main Account and Proframe account switcher. The selected account controls all displayed balances, activity, trading history, status and eligible actions.
- Community: investor-safe education, CEO-published trade lessons/updates, announcements and discussions.
- Profile: identity, verification, security and preferences.
- No access to Validator, trade creation, private strategy configuration or CEO Command Center.

### CEO
- Existing Command Center and Trade Validator remain available.
- CEO can also preview/open the public Homepage.
- CEO manages investors, products, Proframes, risk policies, cycles, settlements, community publishing and reconciliation.
- Existing ADMIN role is retained as the CEO permission boundary unless the audit finds a reason to extend roles.

## Milestones (vertical slices: backend + UI together)

### M0 — Audit and freeze (completed)
- [x] Audit production schema, RLS, financial RPCs, migrations, functions and current routes.
- [x] Record current data counts and protect existing records.
- [x] Identify architecture gaps before changing schema.

### M1 — Role-aware application shell (passed)
- [x] Keep the public root route available to visitors and signed-in users.
- [x] Build role-aware navigation: Investor = Home / MetaFund / Community / Profile; CEO = Validator / MetaFund / Community / Profile, with a Homepage preview/action.
- [x] Add server route-level investor restrictions for private trading pages; database/API authorization certification remains in M7.
- [ ] Complete separate-user route and private API/RPC penetration tests.

### M2 — Proframe domain model + catalogue (in progress)
- [x] Add versioned Proframe products/plans and availability/status, with RLS.
- [x] Add Proframe account instance and purchase-order structures with owner, product-version snapshots, lifecycle state, currency and risk settings.
- [x] Add operator-owned third-party Instant Funding account registry; store provider references only, never passwords.
- [x] Build CEO Proframe Operations console for draft bundle creation, publishing/pausing and provider account recording.
- [x] Add public homepage catalogue for published bundles and risk/eligibility disclosures.
- [ ] Add a certified Main Account wallet/ledger debit bridge, atomic idempotent purchase RPC and audit trail before enabling live purchases.
- [ ] Add provider-account assignment/fulfilment controls and tests for insufficient balance, duplicate requests, concurrency and account creation.

### M3 — Main Account and Proframe account experience
- [ ] Extend account switcher and financial summary to return the selected account.
- [ ] Keep Main Account deposits and withdrawals distinct from Proframe capital.
- [ ] Show Proframe status, capital, performance, trade history and distributions.
- [ ] Test that switching accounts never mixes balances or histories.

### M4 — Account-specific trading risk and allocations
- [ ] Resolve risk basis and snapshot account type/risk policy at trade allocation time.
- [ ] Enforce Main Account 2% and Proframe 0.5% as separate server-side policies.
- [ ] Link each trade participation to the exact investor participation and operator-procured third-party prop-firm account.
- [ ] Preserve existing execution boundary and immutable allocation snapshots.
- [ ] Calculate the 3% payout threshold from the configured profile's defined reference balance and eligible realised profit; show progress and remaining amount. A 3% target is a payout eligibility condition, not a promise or guarantee. Two trades at 0.5% risk do not automatically guarantee reaching 3%; actual outcome depends on results.\n- [ ] Test risk calculations, concurrent allocations, rule-profile versioning and loss handling.

### M5 — Proframe cycle settlement
- [ ] Add Proframe-specific cycle participation and settlement attribution.
- [ ] Calculate gross P&L, investor/company split and net distributable profit.
- [ ] Credit investor share to Main Account through balanced, idempotent ledger/journal entries.
- [ ] Define and implement Proframe loss / breach / account termination rules.
- [ ] Test profitable, losing, zero-P&L, duplicate-settlement and reversal cases.

### M6 — Investor homepage and Community
- [ ] Complete firm homepage, catalogue, how-it-works and risk disclosures.
- [ ] Build Community publishing and investor-safe read access.
- [ ] Allow CEO to publish educational trade summaries without exposing Validator internals.
- [ ] Test permissions and mobile usability.

### M7 — Production certification
- [ ] Reconcile financial ledger and double-entry accounting.
- [ ] Run investor and CEO end-to-end acceptance tests.
- [ ] Verify all protected routes and RLS policies with separate test users.
- [ ] Verify deployment, rollback path, audit trail and existing record preservation.

## Explicit non-goals for this rebuild

- Do not delete or replace existing investor, trade, screenshot, analysis, deposit, withdrawal or accounting records.
- Do not rebuild the existing AI validator or change its trading strategy as part of the investor-platform work.
- Do not add broker integrations, payment-gateway automation, subscriptions or unrelated features without a separate requirement.
- Do not display unverified returns or promise that an account cannot lose money.

## Confirmed Proframe commercial and accounting rule

The user confirmed **Model B**: the Proframe purchase price is an activation/participation fee, not the trading capital and not investor-owned withdrawable cash. The operator separately procures the actual third-party Instant Funding account. The provider account's notional size, operator procurement cost, investor activation payment, trade performance and investor distributions must remain distinct in the data model and accounting. Profit distributions, when earned and approved under provider rules, are credited to the investor's Main Account. The activation fee must never be displayed as Proframe trading capital or as a withdrawable investor balance.

Live purchase/debit is intentionally not enabled yet. It must be implemented atomically against the certified Main Account balance calculation and double-entry accounting; do not substitute a provisional balance formula or debit the existing ledger until that bridge is verified.
