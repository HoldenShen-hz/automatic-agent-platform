# Legal Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §82 |
| implementation_module | `src/domains/legal/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Licensed Attorney / Legal Lead |

## Hard Constraints

- Agents only provide legal information and do not provide final legal opinions.
- All outputs sent externally or acted upon must be reviewed by a licensed attorney.
- Contract red lines, FTO, and dispute recommendations must retain evidence.

## Acceptance Criteria

- Prior to GA, evidence of attorney review, output sign-off, citation evidence, and responsibility boundary records must be provided.