# Healthcare Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §89 |
| implementation_module | `src/domains/healthcare/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Licensed Physician / Medical Compliance Lead |

## Hard Constraints

- Agent only provides medical information, not medical advice.
- All diagnosis and treatment recommendations must be reviewed by a licensed physician.
- PHI handling must comply with minimization, isolation, and audit requirements.

## Acceptance Criteria

- Prior to GA, must provide physician review, PHI isolation, liability boundary, and patient safety assessment evidence.