# Live Streaming Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §83 |
| implementation_module | `src/domains/live-streaming/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | Live Streaming Safety Lead |

## Hard Constraints

- Violation content detected must be taken down or stream cut within target SLA.
- Hot path must not rely on general LLM/harness loop.
- Appeals, restoration, and false positive handling must be auditable.

## Acceptance Criteria

- Prior to GA, must provide real-time detection, 5s disposal, appeals process, and false positive assessment evidence.
