# Financial Services Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §74 |
| implementation_module | `src/domains/financial-services/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Financial Compliance Lead / Credit Lead |

## Hard Constraints

- Adverse credit decisions must be explainable and subject to manual review.
- AML/SAR/STR related judgments must retain audit evidence.
- Agents must not act as the final credit-granting entity.

## Acceptance Criteria

- Before GA, must provide fair lending explanation, manual review, AML detection, and compliance reporting evidence.