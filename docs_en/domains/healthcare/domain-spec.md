# Healthcare Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §89 |
| implementation_module | `src/domains/healthcare/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Licensed Physician / Healthcare Compliance Lead |

## Hard Constraints

- Agent provides medical information only, not medical advice.
- All clinical recommendations must be reviewed by a licensed physician.
- PHI handling must comply with minimization, isolation, and audit requirements.

## Acceptance Criteria

- Physician review, PHI isolation, responsibility boundaries, and patient safety assessment evidence must be provided before GA.
