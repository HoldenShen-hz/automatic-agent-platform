# ADR-082 Natural Language Entry And Goal Decomposition

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Natural language input collection, multi-language parsing, entity extraction
- **Assess**: Ambiguity detection, risk estimation, confirmation demand judgment
- **Plan**: Goal decomposition, task DAG, cross-domain dependency graph generation
- **Execute**: Map decomposition results to controlled requests and execution plans
- **Feedback**: User feedback, multi-round correction, plan revision
- **Learn**: Template hit rate and decomposition quality optimization
- **Improve**: Prompt / template / planner strategy improvement
- **Release**: NL pipeline and GoalDecomposer rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

v2.7 `§39-§40` requires the platform to provide natural language entry and goal decomposition engine for end users. The repository already has:

- `src/interaction/nl-gateway`
- `src/interaction/goal-decomposer`

But lacks clear decisions on how the two connect with existing Runtime / OAPEFLIR / API contracts.

## Decisions

### 1. Natural language entry and execution entry are separated

`NlGateway` is responsible for:

- locale parsing
- intent / entity extraction
- risk preview
- clarification decision
- generating `RequestEnvelope`

It does not directly execute workflows.

### 2. `GoalDecomposer` is responsible for cross-domain goal decomposition, does not directly hold execution authority

`GoalDecomposer` is responsible for:

- Generating `GoalDecomposition`
- Building `TaskDependency`
- Providing cost, duration, risk estimates
- Indicating `requiresHumanReview`

Actual execution is still taken over by orchestration / execution plane.

### 3. Natural language results must map to structured contracts

Natural language entry output must converge to:

- `RequestEnvelope`
- `RiskPreview`
- `GoalDecomposition`
- `TaskDependencyGraph`

Execution plane cannot directly consume loose prompt text.

### 4. Ambiguity prioritizes entering clarification instead of speculative execution

When confidence is below threshold, risk is high, or key entities are missing, the system must:

- Block automatic execution
- Enter clarification
- Record clarification questions and status

## Consequences

- `src/interaction/nl-gateway` and `src/interaction/goal-decomposer` will become controlled bridges from Interface Plane to Orchestration Plane
- Contract boundary between natural language and execution plane clarified
- Subsequent implementation prioritizes schema, state machine, and multi-round dialogue testing
