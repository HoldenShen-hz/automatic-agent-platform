# Education and Training Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §90 |
| implementation_module | `src/domains/education/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | Education Lead / Minors Data Protection Lead |

## Hard Constraints

- Data involving minors must be minimally collected with guardian consent.
- Learning recommendations must not replace the final judgment of teachers or institutions.
- Content recommendations must pass safety and age-appropriateness checks.

## Acceptance Criteria

- GA must provide guardian consent, data minimization, content safety, and human review evidence before release.