# Legal Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §82 |
| implementation_module | `src/domains/legal/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Practicing Lawyer / Legal Lead |

## Hard Constraints

- Agent only provides legal information, not final legal opinions.
- All outbound or actioned outputs must be reviewed by a practicing lawyer.
- Contract red lines, FTO, and dispute recommendations must preserve evidence.

## Acceptance Criteria

- Before GA, evidence must be provided for: lawyer review, output sign-off, citation evidence, and responsibility boundary records.
