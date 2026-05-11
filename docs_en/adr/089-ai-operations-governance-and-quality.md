# ADR 089: AI Operations Governance and Quality

## Status

Accepted

## Date

2026-04-20

## Context

`§15`-`§18`, `§21`, `§23`, `§27` define AI operations capabilities including LLM Provider, Prompt, Eval, Cost, HITL, Compliance, and SLO. Historically, these capabilities were distributed across provider, prompt governance, quality, budget, and approval contracts, but there was no unified ADR explaining why the AI layer must be treated as a governable runtime rather than a plain dependency.

## Decision

The AI operations layer adopts a unified governance model:

- LLM Providers must connect through ModelGateway abstraction, with routing, failover, observability, and degradation capabilities.
- Prompts, models, and policies must all be versioned, canary-releasable, rollbackable, and auditable.
- Eval and quality gates are part of the release pipeline, not an offline reporting attachment.
- Token and model costs must enter the budget, metering, chargeback, and optimization closed loop.
- HITL is a formal control path, not a UI interaction edge case.
- Compliance, data classification, prompt handling, and SLO/error budget collectively determine whether an AI action can execute.

## Trade-offs

- Do not use model vendor APIs as the platform's primary contract, to avoid vendor lock-in.
- Do not allow prompts to enter production without going through governance.
- Do not treat costs as mere reporting displays; costs must participate in pre-execution budget guards and post-execution optimization.

## Consequences

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

- Unit tests: provider selection, prompt version policy, budget guard, quality gate.
- Integration tests: prompt/model release, HITL approval, cost attribution.
- Contract tests: AI actions that fail quality gates, budget checks, or data classification must not execute.

## Alternatives

1. **Use model vendor APIs as the platform's primary contract**: Clear information, but increases vendor lock-in risk.
2. **Allow prompts to enter production without governance**: Reduces governance cost, but cannot guarantee quality, compliance, or safety.
3. **Treat costs as mere reporting displays**: Simple implementation, but costs cannot participate in pre-execution guards or post-execution optimization.
4. **Adopt this decision**: Unify governance of the AI operations layer to ensure quality, safety, compliance, and cost control.

## References

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
