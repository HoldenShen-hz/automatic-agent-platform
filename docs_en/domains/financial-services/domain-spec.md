# Financial Services Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §74 |
| implementation_module | `src/domains/financial-services/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Financial Compliance Officer / Credit Officer |

## Hard Constraints

- Adverse credit decisions must be explainable and human-reviewable.
- AML / SAR / STR related judgments must retain audit evidence.
- Agent must not serve as the final credit authority.

## Acceptance Entry Criteria

- Prior to GA, evidence of fair lending explanations, human review, AML detection, and compliance reports must be provided.