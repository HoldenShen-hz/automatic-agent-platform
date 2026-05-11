# ADR-087 Ops Maturity Runtime

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Signals such as explainability, circuit breaking, lifecycle, drift, cost, debugging, multimodal, and capacity
- **Assess**: Anomaly drift, cost optimization, capacity prediction, explainability depth, and panic recovery assessments
- **Plan**: Debugging, reporting, edge sync, and self-operating strategy generation
- **Execute**: Explainability generation, global circuit breaking, edge execution, debugging, report generation, self-operating actions
- **Feedback**: Explainability usage, circuit breaking drills, debugging replay, capacity prediction deviation feedback
- **Learn**: Behavior fingerprints, cost optimization, capacity trends, and operational experience accumulation
- **Improve**: Agent lifecycle, edge capabilities, and continuous evolution of platform operation agents
- **Release**: Phased rollout of maturity capabilities

---

- Status: Accepted
- Decision Date: 2026-04-20

## Context

v2.7 `§59-§69` introduces the operational maturity layer. The current repository contains:

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

With the exception of `drift-detection`, most are still skeleton code.

## Decision

### 1. Operational maturity capabilities are unified as a Runtime Extension Layer, not scattered toolbox

These capabilities all revolve around "how the platform runs safely, explainably, and recoverably," and must share:

- evidence model
- lifecycle
- rollout / rollback
- audit trail

### 2. Panic, Explainability, Debug, and Report must connect to the same evidence plane

These capabilities must reuse `state-evidence` and cannot each maintain private audit models.

### 3. Edge, Multimodal, and Self-Operating Agents must inherit existing security and governance boundaries

New execution forms cannot bypass:

- sandbox
- policy engine
- budget
- rollout

### 4. Operational maturity capabilities must have contracts first, then proceed with large-scale implementation

Because these capabilities span multiple planes, without authoritative contracts, fragmented implementations can easily emerge.

## Consequences

- `ops-maturity` will be advanced as a unified runtime extension layer, rather than each directory evolving independently
- Subsequent priority will be given to contract alignment for explainability, panic, agent lifecycle, edge runtime, and cost optimizer
