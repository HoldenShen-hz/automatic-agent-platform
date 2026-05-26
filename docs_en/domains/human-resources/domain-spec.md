# Human Resources Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §87 |
| implementation_module | `src/domains/human-resources/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | HR Lead / Compliance Lead |

## Hard Constraints

- Automation of recruitment, promotion, and performance must pass bias audits.
- AIR must be greater than or equal to 0.8; automated decisions are not allowed if the threshold is not met.
- Candidate and employee data must be collected minimally and be auditable.

## Acceptance Criteria

- Prior to GA, evidence of bias audits, human review, data minimization, and appeal processes must be provided.