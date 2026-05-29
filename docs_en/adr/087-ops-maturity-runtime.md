# ADR-087 Ops Maturity Runtime

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Explainability, circuit breaker, lifecycle, drift, cost, debugging, multimodal, capacity signals
- **Assess**: Abnormal drift, cost optimization, capacity prediction, explainability depth, and panic recovery evaluation
- **Plan**: Debugging, reporting, edge synchronization, and self-ops strategy generation
- **Execute**: Explainability generation, global circuit breaker, edge execution, debugging, report generation, self-ops actions
- **Feedback**: Explainability usage, circuit breaker drills, debugging replay, capacity prediction deviation return
- **Learn**: Behavior fingerprint, cost optimization, capacity trends, and operational experience沉淀
- **Improve**: Agent lifecycle, edge capability, platform ops agent continuous evolution
- **Release**: Maturity capability phased rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

The current authoritative correspondence is in the explainability, drift, debugger, edge, and ops maturity sections of `docs_zh/architecture/00-platform-architecture.md`. The repository already has:

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

Except for `drift-detection`, most are still偏骨架.

## Decision

### 1. Ops Maturity Capabilities Are Unified as a Runtime Extension Layer, Not a Scattered Toolbox

These capabilities all围绕"platform how to safely, explainably, recoverably run", must share:

- evidence model
- lifecycle
- rollout / rollback
- audit trail

### 2. Panic, Explainability, Debug, Report Must Connect to the Same Evidence Plane

These capabilities must all reuse `state-evidence`, cannot each maintain private audit models.

### 3. Edge, Multimodal, Self-Ops Agent Must Inherit Existing Security and Governance Boundaries

New execution forms cannot bypass:

- sandbox
- policy engine
- budget
- rollout

### 4. Ops Maturity Capabilities Must First Have Contract, Before Large-Scale Implementation

Because these capabilities span multiple planes, without authoritative contract, fragmented implementations easily form.

## Consequences

- `ops-maturity` will advance as a unified runtime extension layer, not evolving directory by directory
- Subsequent implementation prioritizes explainability, panic, agent lifecycle, edge runtime, cost optimizer contract alignment