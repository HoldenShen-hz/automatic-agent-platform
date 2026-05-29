# Quantitative Trading Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §71 |
| implementation_module | `src/domains/quant-trading/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Licensed Trading Lead / Risk Control Lead |

## Hard Constraints

- All order candidates must pass pre-trading risk checks.
- Position, loss limits, and trading hot paths must not be overwritten by Agent.
- Ultra-low-latency order paths must not rely on general LLM/harness loop.

## Acceptance Criteria

- DomainDescriptor, DomainRiskProfile, DomainEvalFramework must first pass §38 four-stage gate.
- GA must provide trading risk control, backtesting, human approval, audit, and kill-switch evidence before release.