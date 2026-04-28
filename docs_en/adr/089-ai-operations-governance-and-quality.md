# ADR 089: AI Operations Governance and Quality

## Status

Accepted

## Date

2026-04-20

## Background

`§15`-`§18`, `§21`, `§23`, `§27` define AI operations capabilities such as LLM Provider, Prompt, Eval, Cost, HITL, Compliance, SLO. In the past, these capabilities were respectively placed in provider, prompt governance, quality, budget, and approval contracts, but there was a lack of a unified ADR explaining why the AI layer must be treated as a governable runtime rather than a common dependency.

## Decisions

The AI operations layer adopts a unified governance model:

- LLM Provider must be connected through ModelGateway abstraction, with routing, failover, observability, and degradation capabilities.
- Prompt / model / policy must all be versioned, canary-deployable, rollbackable, and auditable.
- Eval and quality gates are part of the release pipeline, not an offline report ancillary capability.
- Token / model costs must enter the budget, metering, chargeback, optimization closed loop.
- HITL is a formal control path, not a UI interaction special case.
- Compliance, data classification, prompt handling, SLO / error budget together determine whether an AI action can be executed.

## Trade-offs

- Do not use the model vendor API as the platform's primary contract, to avoid vendor lock-in.
- Do not allow prompts to directly enter production without going through governance.
- Do not allow costs to only be displayed as reports; costs must be able to participate in pre-execution budget guards and post-execution optimization.

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
- Contract tests: AI actions that do not pass quality gates, budget, or data classification must not be executed.

## Alternative Options

1. **Use the model vendor API as the platform's primary contract**: Clear information, but increases vendor lock-in risk.
2. **Allow prompts to directly enter production**: Reduces governance cost, but cannot guarantee quality, compliance, and security.
3. **Costs only as report display**: Simple implementation, but costs cannot participate in pre-execution guards and post-execution optimization.
4. **Adopt this decision**: Unified governance of AI operations layer, ensuring quality, security, compliance, and cost control.

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
