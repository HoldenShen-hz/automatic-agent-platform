# ADR-087 Ops Maturity Runtime

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Explainability, circuit-breaking, lifecycle, drift, cost, debugging, multimodal, capacity and other signals
- **Assess**: Abnormal drift, cost optimization, capacity prediction, explainability depth, and panic recovery evaluation
- **Plan**: Debugging, reporting, edge sync, and self-ops strategy generation
- **Execute**: Explanation generation, global circuit-breaking, edge execution, debugging, report generation, self-ops actions
- **Feedback**: Explanation usage, circuit-breaking drills, debugging replay, capacity prediction deviation feedback
- **Learn**: Behavior fingerprint, cost optimization, capacity trends, and ops experience accumulation
- **Improve**: Agent lifecycle, edge capability, platform ops agent continuous evolution
- **Release**: Maturity capability phased rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

The current authoritative source corresponds to the explainability, drift, debugger, edge, and ops maturity chapters in `docs_zh/architecture/00-platform-architecture.md`. The current repository already has:

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

## Decisions

### 1. Ops maturity capabilities are uniformly treated as Runtime extension layer, not a scattered toolbox

These capabilities all revolve around "how the platform runs safely, explainably, recoverably", and must share:

- evidence model
- lifecycle
- rollout / rollback
- audit trail

### 2. Panic, Explainability, Debug, Report must connect to the same evidence plane

These capabilities must all reuse `state-evidence`, and cannot each maintain private audit models.

### 3. Edge, multimodal, self-ops Agent must inherit existing security and governance boundaries

New execution forms cannot bypass:

- sandbox
- policy engine
- budget
- rollout

### 4. Ops maturity capabilities must first have contracts before large-scale implementation

Because these capabilities span multiple planes, without authoritative contracts, fragmented implementations are easily formed.

## Consequences

- `ops-maturity` will advance as a unified runtime extension layer, not evolving separately by directory
- Subsequent implementation prioritizes explainability, panic, agent lifecycle, edge runtime, cost optimizer contract alignment
