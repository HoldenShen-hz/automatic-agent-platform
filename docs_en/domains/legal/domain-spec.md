# Legal Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §82 |
| implementation_module | `src/domains/legal/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Licensed Attorney / Legal Lead |

## Hard Constraints

- Agent only provides legal information, not final legal opinions.
- All outputs that are published or acted upon must be reviewed by a licensed attorney.
- Contract red lines, FTO, and dispute recommendations must retain basis.

## Acceptance Criteria

- GA must provide attorney review, output sign-off, citation evidence, and responsibility boundary records before release.