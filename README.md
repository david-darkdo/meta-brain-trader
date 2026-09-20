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
