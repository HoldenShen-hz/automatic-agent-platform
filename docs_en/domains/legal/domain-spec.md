# Legal Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §82 |
| implementation_module | `src/domains/legal/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Licensed Attorney / Legal Lead |

## Hard Constraints

- Agent only provides legal information, does not provide final legal opinions.
- All outbound or actioned outputs must be reviewed by a licensed attorney.
- Contract red lines, FTO, and dispute recommendations must retain basis.

## Acceptance Entry Criteria

- Prior to GA, evidence of attorney review, output sign-off, citation evidence, and liability boundary records must be provided.