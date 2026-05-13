# ADR-018 Rollout Eleven-State Machine and Six-Phase Release

- Status: Superseded by ADR-075
- Decision Date: 2026-04-17
- Current Authority: ADR-075 "Six-Level Controlled Release and Rollout State Machine"

> Historical record only. Do not implement from this document.

## Background

ADR-018 once proposed a RolloutStatus eleven-state and six-level release model to describe the complete lifecycle from proposal state to progressive rollout to rollback.

As the controlled release chain, state machine boundaries, and rollback thresholds have converged to ADR-075, the state set, traffic classification, thresholds, and transition steps in this document are no longer the authoritative source for the current implementation.

## Conclusion

- ADR-018 is retained as a historical record only, to explain why a more granular rollout state split was explored.
- Any new implementation, tests, operational rules, threshold configuration, or state transitions must reference ADR-075 as the authority.
- For the current release chain, refer directly to ADR-075.

## Reason for Retention

- Historical audit and review documents still reference ADR-018 number.
- Some old discussion records and design branches used ADR-018 as background material, and need to be preserved for traceability.

## Migration Guide

- If you are looking for rollout state definitions, go to ADR-075.
- If you are looking for automatic rollback, canary release, stage gates, or stable-state admission, go to ADR-075.
- If you are fixing ADR-018 references in old documents, change implementation authority to ADR-075, and keep ADR-018 as a historical background reference.
