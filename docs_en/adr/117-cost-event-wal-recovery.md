# ADR-117 Cost Event WAL Recovery

## Status
Accepted

## Background
Cost event write-ahead log already introduces pending/committed status, but the recovery strategy for orphaned pending entries previously had no authoritative description.

## Decision
- Pending WAL entries must be sweepable on a regular schedule.
- Orphan determination must include at least:
  - Status still `pending`
  - Exceeded recovery window
  - No corresponding commit / settle evidence
- Recovery actions allow two types:
  - Mark as `orphaned` for manual audit
  - Safely delete and output audit record
- `unsourcedRecordCount` is only an observability metric, not a replacement for WAL recovery.

## Result
- Cost ledger crash recovery no longer stays at comment level.

## Related Implementation
- `src/platform/five-plane-control-plane/cost-alert/*`
- `src/ops-maturity/cost-optimizer/*`