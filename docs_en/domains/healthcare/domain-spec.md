# Healthcare Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §89 |
| implementation_module | `src/domains/healthcare/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Licensed Physician / Medical Compliance Officer |

## Hard Constraints

- Agent only provides medical information, does not replace medical advice.
- All diagnostic and treatment recommendations must be reviewed by a licensed physician.
- PHI handling must comply with minimization, isolation, and audit requirements.

## Acceptance Entry Criteria

- Prior to GA, evidence of physician review, PHI isolation, liability boundaries, and patient safety assessment must be provided.