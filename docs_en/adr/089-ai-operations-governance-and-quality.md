# ADR 089: AI Operations Governance and Quality

- Status: Accepted
- Decision Date: 2026-04-20

## Background

`§15`-`§18`, `§21`, `§23`, `§27` define AI operational capabilities such as LLM Provider, Prompt, Eval, Cost, HITL, Compliance, SLO. Previously these capabilities landed separately in provider, prompt governance, quality, budget, approval contract, but lacked unified ADR explaining why AI layer must be treated as a governable runtime, not a common dependency.

## Decision

AI operations layer adopts unified governance model:

- LLM Provider must connect via ModelGateway abstraction with routing, failover, observability, and degradation capabilities.
- Prompt / model / policy must all be versioned, canary-deployable, rollback-able, auditable.
- Eval and quality gate are part of release pipeline, not an offline report附属capability.
- Token / model cost must enter budget, metering, chargeback, optimization闭环.
- HITL is a formal control path, not a UI interaction特例.
- Compliance, data classification, prompt handling, SLO / error budget together determine whether AI action can execute.

## Trade-offs

- Do not treat model vendor API as platform primary contract to avoid vendor lock-in.
- Do not allow prompt to directly enter production without governance.
- Do not allow cost to only be a report display; cost must be able to participate in pre-execution budget guard and post-execution optimization.

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

## Testing Requirements

- unit tests: provider selection, prompt version policy, budget guard, quality gate.
- integration tests: prompt/model release, HITL approval, cost attribution.
- contract tests: AI actions not passing quality gate, budget, or data classification must not execute.

## Alternatives

1. **Treat model vendor API as platform primary contract**: Clear information, but increases vendor lock-in risk.
2. **Allow prompt to directly enter production**: Reduces governance cost, but cannot guarantee quality, compliance, and security.
3. **Cost only as report display**: Simple implementation, but cost cannot participate in pre-execution guard and post-execution optimization.
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