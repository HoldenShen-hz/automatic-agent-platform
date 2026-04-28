# Financial Services Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §74 |
| implementation_module | `src/domains/financial-services/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Finance Compliance Lead / Credit Lead |

## Hard Constraints

- Adverse credit decisions must be explainable and subject to human review.
- AML / SAR / STR related judgments must retain audit evidence.
- Agent must not serve as the final credit-granting entity.

## Acceptance Entry Criteria

- Prior to GA, evidence of fair lending explanations, human review, AML detection, and compliance reporting must be provided.
