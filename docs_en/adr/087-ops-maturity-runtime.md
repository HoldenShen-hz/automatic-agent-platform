# ADR-087 Ops Maturity Runtime

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Explainability, circuit breakers, lifecycle, drift, cost, debugging, multimodal, capacity signals
- **Assess**: Anomaly drift, cost optimization, capacity prediction, explainability depth, and panic recovery assessment
- **Plan**: Debugging, reporting, edge sync, and self-operations strategy generation
- **Execute**: Explainability generation, global circuit breaking, edge execution, debugging, reporting, self-operations actions
- **Feedback**: Explainability usage, circuit breaker drills, debugging replay, capacity prediction deviation return
- **Learn**: Behavioral fingerprints, cost optimization, capacity trends, and operational experience accumulation
- **Improve**: Agent lifecycle, edge capabilities, and platform operations agent continuous evolution
- **Release**: Maturity capabilities phased release

---

- Status: Accepted
- Decision Date: 2026-04-20

## Context

v2.7 `§59-§69` introduces the operations maturity layer. The current repository already has:

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

### 1. Operations Maturity Capabilities Are Unified as a Runtime Extension Layer, Not a Scattered Toolbox

These capabilities all revolve around "how the platform runs safely, explainably, and recoverably," and must share:

- evidence model
- lifecycle
- rollout / rollback
- audit trail

### 2. Panic, Explainability, Debug, and Report Must Connect to the Same Evidence Plane

These capabilities must all reuse `state-evidence`; cannot each maintain private audit models.

### 3. Edge, Multimodal, and Self-Operations Agents Must Inherit Existing Security and Governance Boundaries

New execution forms cannot bypass:

- sandbox
- policy engine
- budget
- rollout

### 4. Operations Maturity Capabilities Must Have Contracts First, Before Large-Scale Implementation

Because these capabilities span multiple planes, without authoritative contracts, fragmented implementations easily form.

## Consequences

- `ops-maturity` will advance as a unified runtime extension layer, rather than each directory evolving separately
- Subsequent priority will be given to explainability, panic, agent lifecycle, edge runtime, and cost optimizer contract alignment
