# ADR 089: AI Operations Governance and Quality

## Status

Accepted

## Decision Date

2026-04-20

## Context

`§15`-`§18`, `§21`, `§23`, `§27` define LLM Provider, Prompt, Eval, Cost, HITL, Compliance, SLO, and other AI operations capabilities. These capabilities were previously scattered across provider, prompt governance, quality, budget, approval contracts, but lacked a unified ADR explaining why the AI layer must be treated as a governable runtime, not a ordinary dependency.

## Decision

AI operations layer adopts a unified governance model:

- LLM Provider must be abstracted via ModelGateway with routing, failover, observability, and degradation capabilities.
- Prompt/model/policy must all be versioned, staged, rollbackable, auditable.
- Eval and quality gates are part of the release pipeline, not offline report accessories.
- Token/model costs must enter budget, metering, chargeback, optimization closed loop.
- HITL is a formal control path, not a UI interaction exception.
- Compliance, data classification, prompt handling, SLO/error budget together determine whether AI actions can execute.

## Trade-offs

- Do not use model provider API as the platform primary contract to avoid vendor lock-in.
- Do not allow prompt to directly enter production without governance.
- Do not allow cost to be only for reporting display; cost must be able to participate in pre-execution budget guard and post-execution optimization.

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
- `src/platform/five-plane-control-plane/*`
- `src/domains/eval-framework/*`
- `src/ops-maturity/cost-optimizer/*`

## Test Requirements

- unit tests: provider selection, prompt version policy, budget guard, quality gate.
- integration tests: prompt/model release, HITL approval, cost attribution.
- contract tests: AI actions without passing quality gates, budget, or data classification must not execute.

## Alternative Approaches

1. **Use model provider API as the platform primary contract**: Information is clear, but increases vendor lock-in risk.
2. **Allow prompt to directly enter production**: Reduces governance cost, but cannot guarantee quality, compliance, and security.
3. **Cost as reporting display only**: Simple implementation, but cost cannot participate in pre-execution guard or post-execution optimization.
4. **Adopt this decision**: Unified governance of AI operations layer, ensuring quality, security, compliance, and cost control.

## Cross References

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