# MetaBrain Trader

> **An intelligent trading and investor-performance platform built around validated decisions, auditable results, and disciplined capital management.**

MetaBrain Trader is being built as a focused system first — not as a collection of disconnected features.

The immediate objective is simple:

**Make the Trade Validator reliable, connect it to a controlled MetaFund investor-performance system, establish the Community and Profile foundations, and keep the architecture ready for future execution and financial integrations.**

The guiding principle is:

> **Fast, but correct.**

---

## Vision

MetaBrain Trader is intended to grow into a unified trading technology platform connecting:

**Trade Intelligence → Validation → Execution Infrastructure → Investor Capital → Performance & Accounting → Community → Analytics → External Integrations**

The long-term vision is larger than the current product.

The current product is deliberately smaller so that each core domain can be made reliable before the system expands.

---

# Current Product

The current target is:

1. **Trade Validator**
2. **MetaFund**
3. **Community**
4. **Profile / Settings**

These are the core product domains for the current stage.

### 1. Trade Validator

The Trade Validator is the existing trading intelligence core.

It is responsible for the canonical trading lifecycle, including the areas already implemented in the application:

- trade creation and editing
- multi-step trade workflow
- screenshots
- pre-trade analysis
- post-trade analysis
- AI analysis
- execution state
- trade results
- reflections
- learning insights
- dashboard metrics
- processing/retry flows
- journal functionality

The Trade Validator remains the **source of truth for trading records and trading results**.

We do not create a second trading system for MetaFund.

### 2. MetaFund

MetaFund is the investor-facing performance and internal accounting layer for authorized investors.

The first version is intentionally internal and controlled.

It should provide:

- investor accounts
- investor activation
- capital events
- activation timestamps
- trade eligibility
- deterministic allocation
- investor P&L
- performance history
- accounting ledger
- investment periods/cycles
- withdrawal states
- controlled adjustments
- audit history
- investor dashboard
- administrative controls

The central relationship is:

```
Trade Validator
      ↓
Canonical Trade
      ↓
Verified Trade Result
      ↓
MetaFund Eligibility
      ↓
Deterministic Allocation
      ↓
Investor Ledger
      ↓
Investor Performance
      ↓
Investor Dashboard
```

MetaFund must consume the existing canonical trade lifecycle rather than duplicate it.

### 3. Community

Community provides the social layer that makes MetaBrain Trader feel alive.

The first version should establish the foundation without attempting to rebuild Discord.

Future capabilities may include:

- posts
- trading ideas
- journals
- comments
- profiles
- following
- discovery
- controlled sharing of trading activity

Community features should reference canonical trading records where appropriate rather than creating duplicate trade entities.

### 4. Profile / Settings

Profile and Settings provide the account-level foundation for:

- profile information
- preferences
- security
- notifications
- privacy
- timezone
- future subscriptions
- future connected services

Existing functionality should be extended where possible rather than unnecessarily replaced.

---

# What Is Already Here

The repository is no longer the original foundation-only Trade Journal project.

The current application contains a substantial Trade Validator implementation backed by Supabase and deployed through Vercel.

The codebase currently uses:

- React
- TypeScript
- TanStack Start
- TanStack Router
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- React Query
- Vite
- Tailwind
- Vercel
- GitHub

The production application and actual repository are the source of truth.

The README is documentation — it must never be treated as proof that a feature exists.

---

# What We Are Building Next

## Immediate next objective: MetaBrain Trader Reality Audit

Before implementing MetaFund, the real system must be mapped.

The audit must establish:

1. the exact current Trade Validator workflow;
2. the actual database schema;
3. canonical trade and result records;
4. existing Supabase functions;
5. existing triggers;
6. existing RLS policies;
7. existing storage/security rules;
8. the AI processing pipeline;
9. execution and result states;
10. current dashboard/read models;
11. reusable backend logic;
12. architectural conflicts;
13. MetaFund entities that already exist;
14. MetaFund entities that are actually missing;
15. required migrations;
16. the exact Trade Validator → MetaFund workflow.

The output becomes the:

**MetaFund Implementation Architecture Specification.**

No major MetaFund implementation should begin until this reality audit is reconciled with the actual codebase.

---

# MetaFund Rules

MetaFund is a financial/accounting domain, so correctness matters more than UI convenience.

## Investor activation

Investor participation begins from the moment capital is activated.

Historical trades must not be retroactively attributed to an investor simply because the investor account was created later.

The system must preserve:

- historical trades
- activation timestamp
- eligible trades
- allocated results

as distinct concepts.

## Additional capital

Additional capital is a separate capital event with its own activation timestamp.

It must not silently rewrite the original capital event.

## Deterministic allocation

Financial allocation must be deterministic.

The system should:

1. identify the canonical trade;
2. determine whether it is eligible;
3. identify eligible investors;
4. determine applicable capital;
5. obtain the authoritative trade result;
6. calculate the investor result using configured rules;
7. create the accounting event;
8. update the investor performance projection.

AI must not arbitrarily decide financial allocations.

## Ledger integrity

Investor accounting must be represented through auditable events.

Examples include:

- capital activation
- additional capital
- trade allocation
- investor profit
- investor loss
- withdrawal
- adjustment
- reversal/correction

Balances should not be freely overwritten from the frontend.

Corrections should be represented as controlled accounting events.

Financial processing must be **idempotent** so retries or duplicate backend invocations cannot create duplicate P&L.

---

# Security

Security is part of the architecture, not a later feature.

The system must preserve:

- authenticated access
- authorization
- Supabase Row Level Security
- investor isolation
- private financial records
- private screenshots
- server-side validation
- protected administrative actions
- auditability
- idempotent financial operations
- protection against frontend manipulation

An investor must never be able to access another investor's financial records.

---

# Architecture Principle

## One source of truth

The existing Trade Validator remains authoritative for trading information.

MetaFund owns investor capital, allocation, performance, and accounting.

Community owns social interaction.

Profile / Settings owns account-level preferences and identity.

Each domain should have a clear boundary.

The system should not duplicate data merely because another page needs to display it.

---

# Development Philosophy

MetaBrain Trader is being built according to:

> **Build the smallest complete architecture that can grow into the larger MetaBrain Trader system without requiring a fundamental rewrite.**

That means:

- do not build unnecessary integrations early;
- do not create disposable architecture;
- do not duplicate canonical domains;
- do not fake production functionality;
- do not sacrifice security for speed;
- do not modify working Trade Validator logic without understanding its dependencies;
- do not hard-code financial rules in scattered frontend components;
- do not allow frontend state to become the source of truth for financial records.

The objective is not to build everything immediately.

The objective is to build the **right foundation**.

---

# Development Workflow

Every major change follows:

**AUDIT → ARCHITECTURE → IMPLEMENT → TEST → VERIFY → DEPLOY → AUDIT AGAIN**

### Audit
Inspect the actual repository, database-facing code, production behavior, and security boundaries.

### Architecture
Define the smallest correct change and how it connects to existing domains.

### Implement
Make the change without unnecessarily disturbing working systems.

### Test
Test the feature and its failure paths.

### Verify
Inspect the actual result in the application and backend.

### Deploy
Deploy through the production pipeline.

### Audit Again
Verify that production still matches the intended architecture.

---

# Planned Build Sequence

## Phase 1 — Reality Audit
Map the existing Trade Validator, database, backend logic, security, and production behavior.

## Phase 2 — MetaFund Architecture
Define MetaFund entities, lifecycle, allocation rules, ledger model, and security boundaries.

## Phase 3 — MetaFund Database Layer
Implement only the required new data model and backend logic.

## Phase 4 — Investor Activation
Implement investor identity, capital events, activation, and eligibility.

## Phase 5 — Trade → MetaFund Pipeline
Connect qualifying Trade Validator results to MetaFund through deterministic, idempotent processing.

## Phase 6 — Allocation & Ledger
Implement allocation, investor P&L, accounting events, reconciliation, and auditability.

## Phase 7 — Investor Dashboard
Build the investor-facing MetaFund dashboard.

## Phase 8 — Admin Command Center
Provide controlled investor, capital, allocation, ledger, configuration, and audit management.

## Phase 9 — Community Foundation
Establish the initial community experience and data boundaries.

## Phase 10 — Profile / Settings
Complete account-level settings and preferences.

## Phase 11 — Full Integration Testing
Test the complete lifecycle across Trade Validator and MetaFund.

## Phase 12 — Security & Reconciliation Audit
Verify RLS, investor isolation, permissions, idempotency, accounting consistency, and recovery from failures.

## Phase 13 — Production Verification
Deploy and verify against the acceptance criteria.

---

# What Is NOT Required Yet

The current stage does **not** depend on:

- Stripe
- Kora
- another payment gateway
- MT5 API
- broker API
- automated broker execution
- automated withdrawals
- automated settlement
- external KYC infrastructure

These are future integration boundaries.

They should not delay the current product.

The internal MetaFund architecture should simply leave clean interfaces for them later.

---

# Future Architecture

### Payment integration

```
MetaFund
   ↓
Payment Adapter
   ↓
Payment Provider
   ↓
Webhook
   ↓
MetaBrain
   ↓
Ledger
```

### Trading execution

```
Trade Validator
   ↓
Execution Service
   ↓
Broker / MT5 Adapter
   ↓
Broker / MT5
   ↓
Execution Event
   ↓
MetaBrain
```

Future providers should sit behind provider-independent integration boundaries.

---

# Source of Truth

When documentation, old prompts, generated code, or assumptions disagree with the running system:

**inspect the actual system.**

The authoritative reality is:

- the repository;
- the database behavior;
- the deployed application;
- backend functions;
- security configuration;
- production verification.

Documentation communicates intent.

It does not replace inspection.

---

# Current Mission

**Make MetaBrain Trader a reliable, auditable, intelligent trading platform — starting with a strong Trade Validator and a controlled MetaFund investor-performance system.**

Build the core correctly.

Keep the boundaries clean.

Move fast without creating disposable architecture.

Then expand.


---

# MetaFund Architecture Decisions — Current Working Model

The following decisions were established after the initial README was written and are now part of the working product architecture.

## App Navigation Model

MetaBrain Trader is an application, not a conventional website dashboard.

The primary navigation is fixed around four independent product surfaces:

1. Trade Validator
2. MetaFund
3. Community
4. Profile

Primary navigation belongs in the app's bottom navigation on supported app layouts.

Profile contains account/settings functionality. For authorized operators, Profile/Settings exposes the Admin entry point to a separate administrative command center.

The four primary surfaces should not be replaced by a large website-style sidebar as the main product navigation.

## MetaFund Result Model

MetaFund uses a percentage-based trading result model.

The trader records the authoritative result of a closed trade during Post-Trade, for example:

- +2.00%
- -1.25%
- 0.00%

That percentage is consumed by both the existing Post-Trade/AI pipeline and MetaFund's deterministic accounting engine.

There must be one authoritative trade result. MetaFund must not create a second independent result system.

## Per-Trade Capital Snapshot

An investor's capital participating in a trade is determined at the time that trade becomes eligible/participating.

Example:

    Trade starts:
    Investor capital = $10,000

    During the trade:
    Investor deposits $5,000

    Trade closes:
    Trade result = +2%

    MetaFund calculation:
    $10,000 × 2% = $200

The later $5,000 deposit must not retroactively affect the already-open trade.

The new capital becomes available for future eligible trades according to its activation timestamp.

This requires an immutable or auditable per-trade participation/capital snapshot.

## Risk vs Participation Capital

MetaFund must distinguish:

- Participating Capital — investor capital used as the base for that trade's result.
- Risk % — the strategy/trade risk percentage.
- Risk Amount — the monetary risk implied by participating capital and the trade's risk percentage.

These are related but are not the same financial concept.

The existing Trade Validator already contains trade-level risk/account information. MetaFund should consume authoritative data rather than recreate it.

## Compounding

Within an active investment cycle, realized investor P&L contributes to the investor's current economic equity.

Example:

    Starting capital       $10,000
    Cycle profit            $1,000
    Current equity          $11,000

    Next eligible trade uses $11,000

The next trade therefore uses the current eligible equity/capital snapshot, not the original opening capital.

## Cycle Settlement and Profit Share

The default investment cycle is 3 months, but the duration must be configurable.

The system must not scatter hard-coded 90-day or equivalent logic throughout the application.

A configurable investment/cycle policy should support durations such as days, months, and years, with the default currently set to 3 months.

At cycle settlement, net cycle profit is allocated according to the configured profit-sharing rule.

The current working economic configuration is:

    Investor share: 70%
    Company/operator share: 30%

This is a configurable business rule, not a value that should be hard-coded across frontend components.

The system should settle the cycle before rolling the investor's share into the next settled capital base.

## Withdrawal Settlement

Withdrawals require explicit orchestration because a withdrawal can occur before the current cycle naturally expires.

The working rule is:

> A withdrawal request crystallizes the applicable current-cycle performance before the withdrawal is processed.

Example:

    Current settled capital: $10,000
    Current cycle P&L:       +$2,000
    Current economic equity: $12,000

    Cycle settlement:
    Investor share:          +$1,400
    Company share:            +$600

    Investor settled capital:
    $10,000 + $1,400 = $11,400

    Withdrawal:
    $5,000

    Remaining investor capital:
    $6,400

The exact implementation must account for active/committed capital and must prevent withdrawals from bypassing open-trade exposure.

A withdrawal request should therefore have a controlled lifecycle rather than directly editing an investor balance.

## Active Trade Protection

The accounting model must distinguish, where required:

- available capital/equity;
- capital committed to active trades;
- capital snapshots attached to specific trades;
- settled investor capital;
- unsettled current-cycle performance.

An investor must not be able to withdraw capital that is currently required to support an active trade.

If necessary, a withdrawal request waits until required active trades close and their authoritative results are recorded before settlement/processing.

## Accounting Source of Truth

Investor balances must never be freely edited as a number.

Financial state must be derived from auditable accounting events such as:

- capital activation;
- additional capital;
- trade participation;
- trade profit/loss;
- cycle settlement;
- investor profit share;
- company/operator profit share;
- withdrawal;
- adjustment;
- reversal/correction.

The ledger is authoritative. Dashboard balances are projections/read models derived from the accounting state.

Configuration may change business rules. It must not rewrite accounting history.

## Role Model

The initial role model is intentionally small:

- Admin / Trader / Owner — operator role for the current business.
- Investor — investor-facing role.

The operator uses the same application as everyone else.

The operator does not enter a separate admin application from the primary navigation.

Instead:

    Profile
      ↓
    Settings
      ↓
    Admin
      ↓
    Admin Command Center

The Admin Command Center is a separate protected administrative surface containing operational functionality such as investors, capital events, investment cycles, allocations, performance, withdrawals, ledger, configuration, notifications, and audit.

## Foundation-First Principle

The project must be built from the foundation upward.

Before adding visible features, determine the underlying canonical models, state transitions, ownership boundaries, accounting invariants, security policies, and integration points that those features depend upon.

The preferred sequence is:

    REALITY AUDIT
        ↓
    CANONICAL ARCHITECTURE
        ↓
    FOUNDATION / DATA MODEL
        ↓
    DOMAIN SERVICES & STATE TRANSITIONS
        ↓
    INTEGRATION WITH EXISTING TRADE VALIDATOR
        ↓
    READ MODELS
        ↓
    USER INTERFACES
        ↓
    ADMIN / OPERATIONS
        ↓
    COMMUNITY / SECONDARY FEATURES
        ↓
    FULL VERIFICATION

The exact implementation order must be determined after the Stage Zero Reality Audit.

Do not assume the order above is final without reconciling it against the actual production database, codebase, deployed Edge Functions, RLS, and existing Trade Validator dependencies.

## Stage Zero Gate

Before implementing MetaFund or restructuring the application, the system must undergo a complete reality audit.

The audit must inspect the actual:

- repository;
- route tree;
- page/component architecture;
- state management;
- Supabase migrations;
- current production database schema;
- database functions;
- triggers;
- RLS policies;
- storage policies;
- Edge Functions;
- AI orchestration;
- Trade Validator stages;
- Post-Trade workflow;
- result model;
- job processing;
- Strategy OS;
- dashboard/read models;
- authentication;
- authorization;
- deployment configuration;
- environment configuration;
- production deployment;
- known legacy/schema drift.

The audit must identify what is canonical, what is legacy, what is incomplete, what is reusable, what is unsafe to modify, and what is missing.

**No major implementation should begin until the audit report and resulting implementation roadmap have been reviewed and reconciled.**