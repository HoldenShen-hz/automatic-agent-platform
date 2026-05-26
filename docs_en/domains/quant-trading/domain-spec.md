# Quant Trading Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §71 |
| implementation_module | `src/domains/quant-trading/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Licensed Trader / Risk Manager |

## Hard Constraints

- All order candidates must pass pre-market risk control checks.
- Position, loss limits, and trading hot paths must not be overwritten by Agents.
- Ultra-low-latency order execution paths must not rely on general LLM/Harness loops.

## Acceptance Entry

- DomainDescriptor, DomainRiskProfile, and DomainEvalFramework must first pass the §38 four-phase gate.
- Pre-GA must provide trading risk control, backtesting, human approval, audit, and kill-switch evidence.