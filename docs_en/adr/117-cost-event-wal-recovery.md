# ADR-117 Cost Event WAL Recovery

## Status
Accepted

## Decision
- Pending WAL entries must be sweepable.
- Orphan detection must use age plus missing commit evidence.
- `unsourcedRecordCount` is an observation signal, not a recovery mechanism.

