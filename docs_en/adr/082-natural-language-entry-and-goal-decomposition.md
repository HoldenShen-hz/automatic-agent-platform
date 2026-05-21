# ADR-082: Natural Language Entry And Goal Decomposition

---

## OAPEFLIR Relationship

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Natural language input collection, multilingual parsing, entity extraction
- **Assess**: Ambiguity detection, risk estimation, confirmation demand judgment
- **Plan**: Goal decomposition, task DAG, cross-domain dependency graph generation
- **Execute**: Map decomposition results to controlled requests and execution plans
- **Feedback**: User feedback, multi-round correction, plan revision
- **Learn**: Template hit rate and decomposition quality optimization
- **Improve**: Prompt / template / planner strategy improvement
- **Release**: NL pipeline and GoalDecomposer staged rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Context

v2.7 `§39-§40` requires the platform to provide natural language entry and goal decomposition engine for end users. The repository already has:

- `src/interaction/nl-gateway`
- `src/interaction/goal-decomposer`

But there is a lack of clear decision explaining how they connect with existing Runtime / OAPEFLIR / API contracts.

## Decision

### 1. Natural Language Entry and Execution Entry are Separated

`NlGateway` is responsible for:

- locale parsing
- intent / entity extraction
- risk preview
- clarification decision
- generating `RequestEnvelope`

It does not directly execute workflows.

### 2. `GoalDecomposer` is Responsible for Cross-Domain Goal Decomposition, Does Not Directly Hold Execution Permissions

`GoalDecomposer` is responsible for:

- generating `GoalDecomposition`
- building `TaskDependency`
- providing cost, duration, and risk estimates
- indicating `requiresHumanReview`

Actual execution is still taken over by the orchestration / execution plane.

### 3. Natural Language Results Must Map to Structured Contracts

Natural language entry output must converge to:

- `RequestEnvelope`
- `RiskPreview`
- `GoalDecomposition`
- `TaskDependencyGraph`

Execution plane cannot directly consume loose prompt text.

### 4. Ambiguity Prioritizes Entering Clarification, Not Guessing Execution

When confidence is below threshold, risk is high, or key entities are missing, the system must:

- Block automatic execution
- Enter clarification
- Record clarification questions and state

## Consequences

- `src/interaction/nl-gateway` and `src/interaction/goal-decomposer` will become controlled bridges from Interface Plane to Orchestration Plane
- Contract boundary between natural language and execution plane clarified
- Subsequent implementation prioritizes schema, state machine, and multi-round dialogue testing