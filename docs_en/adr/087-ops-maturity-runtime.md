# ADR-087 Ops Maturity Runtime

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Signals such as interpretation, circuit breaking, lifecycle, drift, cost, debugging, multimodal, and capacity
- **Assess**: Anomaly drift, cost optimization, capacity prediction, explanation depth, and panic recovery assessment
- **Plan**: Debugging, reporting, edge synchronization, and self-operations strategy generation
- **Execute**: Explanation generation, global circuit breaking, edge execution, debugging, report generation, self-operations actions
- **Feedback**: Explanation usage, circuit breaking drills, debugging replay, capacity prediction deviation feedback
- **Learn**: Behavior fingerprints, cost optimization, capacity trends, and operational experience accumulation
- **Improve**: Continuous evolution of agent lifecycle, edge capabilities, and platform operations agents
- **Release**: Phased rollout of maturity capabilities

---

- Status: Accepted
- Decision Date: 2026-04-20

## Context

v4.3 `§59-§69` introduces the operations maturity layer. The current repository already contains:

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

Except for `drift-detection`, most remain skeletal.

## Decision

### 1. Operations maturity capabilities are uniformly treated as Runtime extension layers, not scattered toolboxes

All these capabilities revolve around "how the platform runs safely, explainably, and recoverably" and must share:

- evidence model
- lifecycle
- rollout / rollback
- audit trail

### 2. Panic, Explainability, Debug, and Report must connect to the same evidence plane

All these capabilities must reuse `state-evidence` and cannot maintain private audit models.

### 3. Edge, multimodal, and self-operating agents must inherit existing security and governance boundaries

New execution forms cannot bypass:

- sandbox
- policy engine
- budget
- rollout

### 4. Operations maturity capabilities must have contracts before advancing large-scale implementation

Because these capabilities span multiple planes, without authoritative contracts, fragmented implementations easily form.

## Consequences

- `ops-maturity` will advance as a unified runtime extension layer, rather than evolving separately by directory
- Subsequent priority implementation will focus on contract alignment for explainability, panic, agent lifecycle, edge runtime, and cost optimizer
