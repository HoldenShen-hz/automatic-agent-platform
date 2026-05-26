# ADR-087 Ops Maturity Runtime

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Signals for explainability, circuit breaker, lifecycle, drift, cost, debug, multimodal, capacity, etc.
- **Assess**: Abnormal drift, cost optimization, capacity prediction, explainability depth, and panic recovery evaluation
- **Plan**: Debug, report, edge sync, and self-ops strategy generation
- **Execute**: Explain generation, global circuit breaker, edge execution, debug, report generation, self-ops actions
- **Feedback**: Explainability usage, circuit breaker drills, debug replay, capacity prediction deviation feedback
- **Learn**: Behavior fingerprint, cost optimization, capacity trends, and ops experience precipitation
- **Improve**: Agent lifecycle, edge capability, platform ops agent continuous evolution
- **Release**: Maturity capability phased rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

The current authoritative source corresponds to explainability, drift, debugger, edge, and ops maturity chapters in `docs_zh/architecture/00-platform-architecture.md`. The current repository already has:

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

Except for `drift-detection`, most are still skeletons.

## Decision

### 1. Ops Maturity Capabilities Are Unified as a Runtime Extension Layer, Not a Scattered Toolbox

These capabilities all revolve around "how the platform runs safely, explainably, and recoverably", must share:

- evidence model
- lifecycle
- rollout / rollback
- audit trail

### 2. Panic, Explainability, Debug, Report Must All Connect to the Same Evidence Plane

These capabilities must all reuse `state-evidence`, cannot each maintain private audit models.

### 3. Edge, Multimodal, Self-Ops Agent Must Inherit Existing Security and Governance Boundaries

New execution forms cannot bypass:

- sandbox
- policy engine
- budget
- rollout

### 4. Ops Maturity Capabilities Must Have Contracts First, Before Large-Scale Implementation

Because these capabilities span multiple planes, without authoritative contracts, fragmented implementations easily form.

## Consequences

- `ops-maturity` will advance as a unified runtime extension layer, not evolving separately by directory
- Subsequent priority implementation: explainability, panic, agent lifecycle, edge runtime, cost optimizer contract alignment
