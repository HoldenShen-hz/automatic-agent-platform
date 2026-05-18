# Human Resources Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §87 |
| implementation_module | `src/domains/human-resources/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | HR Lead / Compliance Lead |

## Hard Constraints

- Recruitment, promotion, and performance automation must pass bias audit.
- AIR must be greater than or equal to 0.8; automated decisions are not allowed if not met.
- Candidate and employee data must be minimally collected and auditable.

## Acceptance Criteria

- Bias audit, human review, data minimization, and appeal process evidence must be provided before GA.
