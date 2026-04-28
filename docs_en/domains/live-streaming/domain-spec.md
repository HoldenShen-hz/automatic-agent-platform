# Live Streaming Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §83 |
| implementation_module | `src/domains/live-streaming/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | Live Streaming Security Lead |

## Hard Constraints

- After violating content is detected, it must be removed or the stream must be terminated within the target SLA.
- Hot path must not rely on general-purpose LLM/harness loop.
- Appeals, restoration, and false positive handling must be auditable.

## Acceptance Criteria

- Before GA, evidence must be provided for: real-time detection, 5-second remediation, appeals workflow, and false positive assessment.
