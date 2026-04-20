# ADR 089: AI Operations Governance and Quality

## Status

Accepted

## Date

2026-04-20

## Context

`§15`-`§18`, `§21`, `§23`, and `§27` define LLM Provider, Prompt, Eval, Cost, HITL, Compliance, and SLO AI operations capabilities. In the past, these capabilities were scattered across provider, prompt governance, quality, budget, and approval contracts, but lacked a unified ADR explaining why the AI layer must be treated as a governable runtime, not an ordinary dependency.

## Decision

The AI operations layer adopts a unified governance model:

- LLM Provider must connect through ModelGateway abstraction, with routing, failover, observability, and degradation capabilities.
- Prompt / model / policy must all be versioned, canaried, rollbackable, and auditable.
- Eval and quality gates are part of the release pipeline, and cannot be treated as offline report附属能力.
- Token / model costs must enter budget, metering, chargeback, and optimization闭环.
- HITL is a formal control path, not a UI interaction特例.
- Compliance, data classification, prompt handling, and SLO / error budget together determine whether AI actions can execute.

## Trade-offs

- Do not treat model vendor API as the platform's primary contract to avoid vendor lock-in.
- Do not allow prompts to directly enter production without going through governance.
- Do not allow costs to only be displayed in reports; costs must be able to participate in pre-execution budget guards and post-execution optimization.

## Impact

Corresponding authoritative contracts:

- `tool_and_provider_execution_contract.md`
- `prompt_model_policy_governance_contract.md`
- `quality_engineering_and_chaos_testing_contract.md`
- `cost_and_budget_contract.md`
- `token_budget_allocation_contract.md`
- `approval_and_hitl_contract.md`
- `hitl_experience_and_explainability_contract.md`
- `data_classification_and_prompt_handling_contract.md`
- `slo_alerting_and_runbook_contract.md`

Corresponding implementation boundaries:

- `src/platform/model-gateway/*`
- `src/platform/prompt-engine/*`
- `src/platform/control-plane/*`
- `src/domains/eval-framework/*`
- `src/ops-maturity/cost-optimizer/*`

## Testing Requirements

- unit tests: provider selection, prompt version policy, budget guard, quality gate.
- integration tests: prompt/model release, HITL approval, cost attribution.
- contract tests: AI actions that fail quality gates, budget, or data classification must not execute.
