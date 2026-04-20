# ADR-082 Natural Language Entry And Goal Decomposition

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Natural language input collection, multilingual parsing, entity extraction
- **Assess**: Ambiguity detection, risk estimation, requirements confirmation judgment
- **Plan**: Goal decomposition, task DAG, cross-domain dependency graph generation
- **Execute**: Map decomposition results to controlled requests and execution plans
- **Feedback**: User feedback, multi-turn correction, plan revision
- **Learn**: Template hit rate and decomposition quality optimization
- **Improve**: Prompt / template / planner strategy improvement
- **Release**: Canary release of NL pipeline and GoalDecomposer

---

- Status: Accepted
- Decision Date: 2026-04-20

## Context

v2.7 `§39-§40` requires the platform to provide natural language entry and goal decomposition engine for end users. The repository already has:

- `src/interaction/nl-gateway`
- `src/interaction/goal-decomposer`

But lacks clear decisions on how these connect with existing Runtime / OAPEFLIR / API contracts.

## Decision

### 1. Natural Language Entry and Execution Entry are Separated

`NlGateway` is responsible for:

- locale parsing
- intent / entity extraction
- risk preview
- clarification decision
- generating `RequestEnvelope`

It does not directly execute workflows.

### 2. `GoalDecomposer` Handles Cross-Domain Goal Decomposition, Does Not Directly Hold Execution Authority

`GoalDecomposer` is responsible for:

- Generating `GoalDecomposition`
- Building `TaskDependency`
- Providing cost, duration, and risk estimates
- Indicating `requiresHumanReview`

Actual execution is still taken over by the orchestration / execution plane.

### 3. Natural Language Results Must Map to Structured Contracts

Natural language entry output must converge to:

- `RequestEnvelope`
- `RiskPreview`
- `GoalDecomposition`
- `TaskDependencyGraph`

Execution plane cannot directly consume loose prompt text.

### 4. Ambiguity Goes to Clarification First, Not Guess Execution

When confidence is below threshold, risk is high, or key entities are missing, the system must:

- Block automatic execution
- Enter clarification
- Record clarification questions and state

## Consequences

- `src/interaction/nl-gateway` and `src/interaction/goal-decomposer` become controlled bridges from Interface Plane to Orchestration Plane
- Contract boundaries between natural language and execution plane are clarified
- Subsequent implementation prioritizes supplementing schemas, state machines, and multi-turn dialogue tests
