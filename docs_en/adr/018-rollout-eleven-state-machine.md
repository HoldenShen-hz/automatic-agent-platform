# ADR-018 Rollout Eleven-State Machine and Six-Stage Release

- Status: Superseded by ADR-075
- Decision Date: 2026-04-17
- Current authoritative specification: ADR-075 "Six-Level Controlled Release and Rollout State Machine"

> Historical record only. Do not implement from this document.

## Background

ADR-018 once proposed a version of `RolloutStatus` eleven-state and six-level release model, describing the complete lifecycle from suggested state to progressive rollout to rollback.

As the controlled release chain, state machine boundaries, and rollback thresholds uniformly converged to ADR-075, the state set, traffic classification, thresholds, and migration steps in this document are no longer the authoritative source for current implementation.

## Conclusion

- ADR-018 is retained only as a historical record, for explaining why more granular rollout state splitting was once explored.
- Any new implementation, testing, operations rules, threshold configuration, or state transitions must be based on ADR-075.
- For current release chain, please directly refer to [ADR-075](./075-controlled-rollout-release.md).

## Reason for Retention

- Historical audit and review documents still reference ADR-018 number.
- Some old discussion records and design branches once used ADR-018 as background material, need to retain traceability.

## Migration Notes

- If looking for rollout state definition, go to ADR-075.
- If looking for automatic rollback, canary release, stage gate, or stable admission, go to ADR-075.
- If fixing old ADR-018 references in old documents, change "execution basis" to ADR-075, retain ADR-018 as historical background reference.