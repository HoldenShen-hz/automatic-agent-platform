# Customer Service Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §91 |
| implementation_module | `src/domains/customer-service/index.ts` |
| domain_status | spec_ready |
| risk_level | medium |
| accountable_role | Customer Service Operations Lead |

## Hard Constraints

- Unresolved after 3 turns must escalate to human agent.
- Agent must not make compensation, refund, or legal commitments beyond authorization.
- User commitments and knowledge sources must be auditable.

## Acceptance Criteria

- Prior to GA, must provide escalation to human, FCR, AHT, knowledge citation, and commitment audit evidence.