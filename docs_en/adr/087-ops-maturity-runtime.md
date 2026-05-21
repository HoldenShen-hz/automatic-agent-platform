# ADR-087: Ops Maturity Runtime

---

## OAPEFLIR Relationship

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Explainability, circuit breaker, lifecycle, drift, cost, debugging, multimodal, capacity signals
- **Assess**: Anomaly drift, cost optimization, capacity prediction, explanation depth, and panic recovery evaluation
- **Plan**: Debugging, reporting, edge sync, and self-operation strategy generation
- **Execute**: Explanation generation, global circuit breaker, edge execution, debugging, reporting generation, self-operation actions
- **Feedback**: Explanation usage, circuit breaker drills, debugging replay, capacity prediction deviation reflux
- **Learn**: Behavior fingerprint, cost optimization, capacity trends, and operational experience accumulation
- **Improve**: Agent lifecycle, edge capability, platform operations agent continuous evolution
- **Release**: Maturity capability phased rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Current authoritative scope corresponds to explainability, drift, debugger, edge, and ops maturity sections in `docs_zh/architecture/00-platform-architecture.md`. The current repository already has:

- `src/ops-maturity/explainability`
- `src/ops-maturity/emergency`
- `src/ops-maturity/agent-lifecycle`
- `src/ops-maturity/edge-runtime`
- `src/ops-maturity/drift-detection`
- `src/ops-maturity/cost-optimizer`
- `src/ops-maturity/workflow-debugger`
- `src/ops-maturity/compliance-reporter`
- `src/ops-maturity/capacity-planner`
- `src/ops-maturity/multimodal`
- `src/ops-maturity/platform-ops-agent`

Except for `drift-detection`, most are still skeleton-heavy.

## Decision

### 1. Operations Maturity Capabilities are Unified as a Runtime Extension Layer, Not a Scattered Toolbox

These capabilities all revolve around "how the platform runs safely, explainably, and recoverably", and must share:

- evidence model
- lifecycle
- rollout / rollback
- audit trail

### 2. Panic, Explainability, Debug, Report Must Connect to the Same Evidence Plane

These capabilities must all reuse `state-evidence`, cannot each maintain private audit models.

### 3. Edge, Multimodal, Self-Operation Agents Must Inherit Existing Security and Governance Boundaries

New execution forms cannot bypass:

- sandbox
- policy engine
- budget
- rollout

### 4. Operations Maturity Capabilities Must Have Contracts First, Then Large-Scale Implementation

Because these capabilities span multiple planes, without authoritative contracts, fragmented implementations easily form.

## Consequences

- `ops-maturity` will advance as a unified runtime extension layer, not evolving directory by directory
- Subsequent implementation prioritizes explainability, panic, agent lifecycle, edge runtime, and cost optimizer contract alignment