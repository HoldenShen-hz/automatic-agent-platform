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
- Position, loss limits, and trading hot paths must not be overridden by agents.
- Ultra-low-latency order paths must not depend on general LLM/Harness loops.

## Acceptance Criteria

- DomainDescriptor, DomainRiskProfile, and DomainEvalFramework must first pass the §38 four-stage gate.
- Prior to GA, evidence of trading risk control, backtesting, human approval, audits, and kill-switch must be provided.