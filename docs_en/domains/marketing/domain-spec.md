# Quantitative Trading Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §71 |
| implementation_module | `src/domains/quant-trading/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Licensed Trading Lead / Risk Control Lead |

## Hard Constraints

- All order candidates must pass pre-market risk checks.
- Position, loss limits, and trading hot paths must not be overwritten by Agent.
- Ultra-low-latency order execution paths must not rely on general LLM/Harness loops.

## Acceptance Criteria

- DomainDescriptor, DomainRiskProfile, and DomainEvalFramework must first pass the §38 four-stage gate.
- Trading risk control, backtesting, manual approval, audit, and kill-switch evidence must be provided before GA.
