# ADR-082 Natural Language Entry And Goal Decomposition

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Natural language input collection, multilingual parsing, entity extraction
- **Assess**: Ambiguity detection, risk estimation, confirmation requirement judgment
- **Plan**: Goal decomposition, task DAG, cross-domain dependency graph generation
- **Execute**: Map decomposition results to controlled requests and execution plans
- **Feedback**: User feedback, multi-turn correction, plan revision
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

But lacks explicit decision explaining how they connect with existing Runtime / OAPEFLIR / API contracts.

## Decision

### 1. Natural Language Entry and Execution Entry Are Separated

`NlGateway` is responsible for:

- locale parsing
- intent / entity extraction
- risk preview
- clarification decision
- generating `RequestEnvelope`

It does not directly execute workflow.

### 2. `GoalDecomposer` Is Responsible for Cross-Domain Goal Decomposition, Does Not Directly Hold Execution Rights

`GoalDecomposer` is responsible for:

- Generating `GoalDecomposition`
- Building `TaskDependency`
- Providing cost, duration, and risk estimates
- Indicating `requiresHumanReview`

Actual execution is still taken over by orchestration / execution plane.

### 3. Natural Language Results Must Map to Structured Contracts

Natural language entry output must converge to:

- `RequestEnvelope`
- `RiskPreview`
- `GoalDecomposition`
- `TaskDependencyGraph`

Execution plane cannot directly consume loose prompt text.

### 4. Ambiguity Prioritizes Clarification Over Guessed Execution

When confidence is below threshold, risk is high, or key entities are missing, the system must:

- Block automatic execution
- Enter clarification
- Record clarification questions and state

## Consequences

- `src/interaction/nl-gateway` and `src/interaction/goal-decomposer` will become controlled bridges from Interface Plane to Orchestration Plane
- Contract boundary between natural language and execution plane is clarified
- Subsequent implementation prioritizes schema, state machine, and multi-turn dialogue tests
