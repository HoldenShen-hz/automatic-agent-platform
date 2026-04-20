# NL Entry And Goal Decomposition Contract

## 1. Scope

This contract defines the natural language entry point, multi-round clarification, and goal decomposition boundaries for `§39-§40`.

## 2. Canonical Objects

- `NlEntryRequest`
- `IntentParseResult`
- `ExtractedEntity`
- `RiskPreview`
- `ClarificationState`
- `Goal`
- `GoalDecomposition`
- `PlannedTask`
- `TaskDependency`

## 3. `IntentParseResult` Minimum Fields

- `raw_input`
- `locale`
- `detected_intents`
- `confidence`
- `requires_clarification`
- `clarification_questions?`
- `continuation`
- `suggested_division_id`
- `suggested_workflow_id`

Rules:

- Low confidence, high risk, and missing entities must all allow `requires_clarification=true`.
- `suggested_division_id` is only a recommendation and does not equal final execution authorization.

## 4. `GoalDecomposition` Minimum Fields

- `goal_id`
- `tasks`
- `dependency_graph`
- `estimated_duration`
- `estimated_cost`
- `risk_summary`
- `decomposition_confidence`
- `requires_human_review`

`PlannedTask` Minimum Fields:

- `task_id`
- `domain_id`
- `description`
- `inputs`
- `expected_outputs`
- `delegation_mode`

## 5. State Machine

`ClarificationState.status`:

- `open`
- `answered`
- `expired`
- `cancelled`

`GoalLifecycle.status`:

- `draft`
- `decomposed`
- `approved`
- `executing`
- `completed`
- `failed`
- `cancelled`

## 6. Boundary Rules

- NL entry must not directly execute runtime side effects.
- GoalDecomposer must not bypass approval, budget, or risk gates.
- The only controlled output from NL to runtime is the structured envelope / decomposition.

## 7. Test Requirements

- unit: intent, entity, clarification, decomposition graph
- integration: NL -> decomposition -> orchestration handoff
- contract: ambiguous requests must not directly enter automatic execution
