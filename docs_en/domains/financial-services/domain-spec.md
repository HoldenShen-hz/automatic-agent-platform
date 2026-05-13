# Financial Services Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §74 |
| implementation_module | `src/domains/financial-services/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Financial Compliance Lead / Credit Lead |

## Hard Constraints

- Adverse credit decisions must be explainable and subject to human review.
- AML/SAR/STR-related judgments must retain audit evidence.
- Agent must not act as the final credit granting entity.

## Acceptance Criteria

- Prior to GA, must provide fair lending explanation, human review, AML detection, and compliance reporting evidence.