# MetaBrain Trader

> **AI-assisted trading intelligence, validation, journaling, and investor-performance infrastructure.**

MetaBrain Trader is being built as a unified trading platform around one core principle:

**Protect capital. Improve decision quality. Preserve an auditable record of every trading decision and result.**

The product is intentionally being built in stages. The current priority is not to build every long-term integration at once. The priority is to make the existing Trade Validator reliable, connect it to a controlled internal investor-performance system (MetaFund), establish the Community and Profile foundations, and keep the architecture ready for future broker and payment integrations.

---

## Product Vision

MetaBrain Trader is intended to become a unified platform with four connected product domains:

1. **Trade Validator** — the trading intelligence and validation engine.
2. **MetaFund** — the investor-performance and internal accounting layer for authorized friends and family.
3. **Community** — the social layer that makes the platform active and allows controlled sharing of trading knowledge and results.
4. **Profile / Settings** — identity, account, preferences, security, and future connected services.

The long-term platform can expand into:

**Trade Intelligence → Execution Infrastructure → Broker/MT5 Integrations → MetaFund → Investor Accounting → Community → Analytics → Subscriptions → External Financial Infrastructure**

The current product is deliberately smaller than that long-term vision.

---

# Current Product Direction

## The immediate target

The first complete MetaBrain Trader version is:

**Trade Validator + MetaFund + Community foundation + Profile/Settings**

The most important new connection is:

**Trade Validator → MetaFund**

The system should use the existing canonical trading lifecycle rather than creating a second, conflicting trading system.

External payment and broker integrations are **future architecture**, not blockers for the current build.

---

# Current State

The repository has evolved significantly beyond the original foundation-only README.

The current application already contains substantial Trade Validator functionality, including areas such as:

- trade creation and editing
- trade lifecycle/state handling
- pre-trade analysis
- post-trade analysis
- AI analysis records
- screenshots
- execution state
- trade results
- reflections
- learning insights
- dashboard metrics
- retryable processing pipelines
- journal functionality
- authenticated application routes
- Supabase-backed persistence
- private screenshot storage
- account/authentication infrastructure

The current application is built with:

- React
- TanStack Start / TanStack Router
- TypeScript
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- React Query
- Vercel
- GitHub

The production application is deployed through Vercel and the GitHub repository is the source repository for the application.

---

# Architecture Principle

## One source of truth

Trade Validator remains the authoritative trading-analysis domain.

MetaFund must consume the appropriate verified trade and result information from that existing lifecycle.

MetaFund must **not** create a second independent trading system simply to display investor performance.

The intended relationship is:

```
Trade Validator
      ↓
Canonical Trade Record
      ↓
Execution / Result State
      ↓
MetaFund Allocation
      ↓
Investor Ledger
      ↓
Investor Performance
      ↓
MetaFund Dashboard
```

This prevents duplicate trades, conflicting results, duplicated P&L, and inconsistent histories.

---

# MetaFund

MetaFund is the internal investor-performance platform for authorized friends and family.

The immediate version does **not** require:

- Stripe
- Kora
- another payment gateway
- MT5 API
- broker API
- automated broker execution
- automated payment settlement
- automated withdrawals
- external KYC infrastructure

Those systems may be integrated later.

The first MetaFund version should work using the trading records and results already generated inside MetaBrain Trader.

## MetaFund goals

MetaFund should eventually support:

- investor accounts
- investor activation
- capital records
- capital activation timestamps
- trade eligibility
- deterministic trade allocation
- investor P&L
- investor performance
- investor ledger
- investment periods/cycles
- withdrawal states
- controlled adjustments
- audit history
- administrator controls
- investor-specific dashboards

Financial records must be auditable.

Balances should not simply be overwritten to make numbers appear correct. Corrections should be represented through controlled accounting events.

---

# Trade Eligibility

An investor should not receive historical performance merely because an account was created later.

The intended rule is:

> **Investor participation begins from the point their capital is activated.**

Therefore, MetaFund must preserve the distinction between:

- historical trades
- investor activation
- eligible trades
- allocated results

This logic must be enforced on the backend, not only through frontend filtering.

---

# Allocation Engine

Investor allocation must be deterministic.

The system should:

1. identify the canonical Trade Validator trade;
2. determine whether the trade qualifies for MetaFund;
3. identify eligible investors;
4. determine the applicable investor capital;
5. obtain the authoritative trade result;
6. calculate the applicable investor result;
7. create the appropriate accounting/ledger event;
8. update the investor performance projection.

AI should not arbitrarily determine financial allocation.

---

# Investor Ledger

MetaFund requires an authoritative accounting ledger capable of representing events such as:

- capital activation
- additional capital
- trade allocation
- investor profit
- investor loss
- withdrawal
- adjustment
- reversal/correction
- related trade
- timestamps
- audit information

Financial operations must be idempotent.

A retry, duplicate event, refresh, or repeated backend invocation must not create duplicate investor P&L.

---

# Administrative Controls

MetaFund will require an administrative control surface for authorized operators.

It should eventually support:

- investor management
- capital activation
- investment status
- performance review
- allocation review
- ledger review
- controlled financial adjustments
- withdrawal state management
- configuration
- audit history

There must not be an unrestricted frontend mechanism for simply editing investor balances.

---

# Community

Community is a product domain, not a replacement for the trading system.

The initial objective is to establish the foundation and make the application feel alive without immediately rebuilding Discord.

Future capabilities may include:

- posts
- trading ideas
- journals
- comments
- profiles
- following
- discovery
- controlled sharing of trade results

Where trade information is shared, it should reference authorized/canonical trading records rather than create duplicate trade entities.

---

# Profile / Settings

Profile and Settings provide the account-level foundation for:

- profile information
- security
- preferences
- notifications
- timezone
- privacy
- subscriptions
- future connected services

The existing implementation should be inspected and extended rather than unnecessarily replaced.

---

# Security

Security is a core architectural requirement.

The platform must preserve:

- authentication
- authorization
- Supabase Row Level Security
- investor isolation
- private financial information
- private trade screenshots
- server-side validation
- controlled administrative actions
- auditability
- protection against frontend manipulation
- idempotent financial operations

No investor should be able to access another investor's financial records.

---

# Development Philosophy

MetaBrain Trader is being built under one rule:

> **Fast, but correct.**

Speed matters, but speed must not create an architecture that has to be thrown away later.

The target is:

> **Build the smallest complete architecture that can grow into the larger MetaBrain Trader system without requiring a fundamental rewrite.**

This means:

- do not build unnecessary future infrastructure now;
- do not create disposable shortcuts;
- do not duplicate existing domains;
- do not invent integrations that are not connected;
- do not fake production functionality;
- do not sacrifice security for UI speed;
- do not modify working Trade Validator functionality without understanding its dependencies.

---

# Development Workflow

Every major phase should follow:

**AUDIT → ARCHITECTURE → IMPLEMENT → TEST → VERIFY → DEPLOY → AUDIT AGAIN**

The actual repository and production environment are the source of truth.

Documentation and previous prompts describe intended direction, but they must never be treated as proof that a feature exists.

Before modifying an existing subsystem:

1. inspect the current implementation;
2. identify its dependencies;
3. identify its authoritative data;
4. identify security boundaries;
5. identify what can be reused;
6. define the change;
7. implement the smallest safe change;
8. test it;
9. verify production.

---

# Immediate Next Work

The next task is the **MetaBrain Trader Reality Audit**.

Before implementing MetaFund, the architecture must be mapped against the actual codebase.

The audit must determine:

1. what the current Trade Validator actually does;
2. the current database schema;
3. the canonical trade lifecycle;
4. the canonical result lifecycle;
5. existing Supabase functions;
6. existing triggers;
7. existing RLS policies;
8. existing storage/security policies;
9. existing AI pipeline;
10. existing execution state;
11. existing dashboard/read models;
12. what MetaFund entities already exist, if any;
13. what new MetaFund entities are actually required;
14. what existing architecture must not be disturbed;
15. what migrations are required;
16. the exact Trade Validator → MetaFund backend workflow.

The output of this audit will become the:

**MetaFund Implementation Architecture Specification**

Only after the architecture has been reconciled with the real codebase should implementation begin.

---

# Planned Build Sequence

## Phase 1 — Reality Audit

Inspect the actual repository, database-facing code, functions, security, and production behavior.

## Phase 2 — MetaFund Domain Architecture

Define entities, relationships, lifecycle states, ledger events, allocation rules, constraints, and security boundaries.

## Phase 3 — Database Layer

Implement the required MetaFund schema and backend logic without duplicating canonical Trade Validator data.

## Phase 4 — Investor Accounts

Implement investor identity, activation, capital events, eligibility, and account state.

## Phase 5 — Trade → MetaFund Connection

Connect qualifying Trade Validator events to MetaFund through deterministic, idempotent backend processing.

## Phase 6 — Allocation & Ledger

Implement investor allocation, accounting events, reconciliation, and performance projections.

## Phase 7 — Investor Dashboard

Build the investor-facing MetaFund experience.

## Phase 8 — Admin Command Center

Build controlled administrative management and audit views.

## Phase 9 — Community Foundation

Establish the Community domain and its core navigation/data foundation.

## Phase 10 — Profile / Settings

Complete account-level settings and preferences.

## Phase 11 — Integration Testing

Test the complete lifecycle across domains.

## Phase 12 — Security & Reconciliation Audit

Test RLS, investor isolation, idempotency, accounting consistency, permissions, and failure recovery.

## Phase 13 — Production Verification

Deploy through Vercel and verify the production system against the acceptance criteria.

---

# Future Integrations

External integrations remain part of the long-term architecture.

### Payments

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

### Trading Execution

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

These boundaries should remain provider-independent.

A future provider such as Stripe, Kora, MT5, or another service should be an implementation behind an integration boundary, not the foundation of the internal domain model.

---

# Long-Term Vision

The long-term MetaBrain Trader system is intended to become a broader trading and investment technology platform:

**Trade Intelligence**

→ **Decision Validation**

→ **Execution Infrastructure**

→ **Broker Connectivity**

→ **Investor Capital Infrastructure**

→ **Performance & Accounting**

→ **Community**

→ **Analytics**

→ **Subscriptions**

→ **External Financial Infrastructure**

The current friends-and-family MetaFund is a controlled first stage of that larger system.

The architecture should remain extensible, but the current build should only implement what is required now.

---

# Source of Truth

When documentation, previous prompts, generated code, and production behavior disagree:

**the actual system must be inspected before a decision is made.**

The repository, database behavior, deployed application, and security configuration are the reality.

Documentation exists to communicate the intended architecture and direction.

---

## Current Mission

**Make MetaBrain Trader a reliable, auditable, intelligent trading platform — starting with a strong Trade Validator and a controlled MetaFund investor-performance system, while preserving a clean path toward the larger vision.**

**Build the foundation correctly. Keep the boundaries clean. Move fast without creating technical debt.**
