# ADR 089: AI Operations Governance and Quality

## Status

Accepted

## Date

2026-04-20

## Context

`§15`-`§18`, `§21`, `§23`, `§27` define LLM Provider, Prompt, Eval, Cost, HITL, Compliance, and SLO AI operations capabilities. Previously, these capabilities were scattered across provider, prompt governance, quality, budget, and approval contracts, but lacked a unified ADR explaining why the AI layer must be treated as a governable runtime rather than a common dependency.

## Decision

The AI operations layer adopts a unified governance model:

- LLM Providers must connect through the ModelGateway abstraction with routing, failover, observability, and degradation capabilities.
- Prompt / model / policy must all be versioned, canary-deployable, rollback-capable, and auditable.
- Eval and quality gates are part of the release pipeline, not附属 offline reporting capabilities.
- Token / model costs must enter the budget, metering, chargeback, and optimization closed loop.
- HITL is a formal control path, not a UI interaction special case.
- Compliance, data classification, prompt handling, and SLO / error budget jointly determine whether AI actions can be executed.

## Trade-offs

- We do not treat model vendor APIs as the platform's primary contract to avoid vendor lock-in.
- We do not allow prompts to enter production directly without governance.
- We do not allow costs to only be displayed as reports; costs must be able to participate in pre-execution budget guards and post-execution optimization.

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

## Test Requirements

- Unit tests: Provider selection, prompt version policy, budget guard, quality gate.
- Integration tests: Prompt/model release, HITL approval, cost attribution.
- Contract tests: AI actions that fail quality gates, budget, or data classification cannot be executed.

## Alternatives

1. **Treat model vendor APIs as the platform's primary contract**: Information is explicit, but increases vendor lock-in risk.
2. **Allow prompts to enter production directly**: Reduces governance cost, but cannot guarantee quality, compliance, or security.
3. **Costs only as report display**: Simple to implement, but costs cannot participate in pre-execution guards or post-execution optimization.
4. **Adopt this decision**: Unified governance of AI operations layer ensures quality, security, compliance, and controllable costs.

## Cross-References

- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-088 Platform Surface, Communication, and Extensibility](./088-platform-surface-communication-and-extensibility.md)

## Source Sections

- `§15 LLM Provider`
- `§16 Prompt`
- `§17 Eval`
- `§18 Cost`
- `§21 HITL`
- `§23 Compliance`
- `§27 SLO`
