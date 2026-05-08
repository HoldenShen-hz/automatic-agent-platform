# ADR-087 Ops Maturity Runtime

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signals for explainability, circuit breaker, lifecycle, drift, cost, debugging, multimodal, capacity, etc.
- **Assess**: Anomaly drift, cost optimization, capacity prediction, explainability depth, and panic recovery assessment
- **Plan**: Debugging, reporting, edge synchronization, and self-ops strategy generation
- **Execute**: Explanation generation, global circuit breaker, edge execution, debugging, report generation, self-ops actions
- **Feedback**: Explanation usage, circuit breaker drills, debugging replay, capacity prediction deviation feedback
- **Learn**: Behavior fingerprint, cost optimization, capacity trends, and ops experience accumulation
- **Improve**: Agent lifecycle, edge capability, platform ops agent continuous evolution
- **Release**: Maturity capability phased rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

v2.7 `§59-§69` introduces the ops maturity layer. The current repository already has:

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

Except for `drift-detection`, most are still skeleton implementations.

## Decisions

### 1. Ops maturity capabilities are uniformly treated as Runtime extension layer, not a scattered toolbox

These capabilities all revolve around "how the platform runs safely, explainably, and recoverably," and must share:

- evidence model
- lifecycle
- rollout / rollback
- audit trail

### 2. Panic, Explainability, Debug, Report must connect to the same evidence plane

These capabilities must all reuse `state-evidence` and cannot each maintain private audit models.

### 3. Edge, multimodal, and self-ops Agent must inherit existing security and governance boundaries

New execution forms cannot bypass:

- sandbox
- policy engine
- budget
- rollout

### 4. Ops maturity capabilities must have contracts first, before large-scale implementation

Because these capabilities span multiple planes, without authoritative contracts, fragmented implementations are easily formed.

## Consequences

- `ops-maturity` will proceed as a unified runtime extension layer, rather than evolving directory by directory
- Subsequent priority will be given to contract alignment for explainability, panic, agent lifecycle, edge runtime, and cost optimizer
