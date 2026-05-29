# ADR-117 Cost Event WAL Recovery

- Status: Accepted

## Background

Cost event write-ahead log has introduced pending/committed status, but recovery strategy for orphaned pending entries previously lacked authoritative description.

## Decision

- Pending WAL entry must be periodically sweepable.
- Orphan determination includes at minimum:
  - Status still `pending`
  - Exceeded recovery window
  - No corresponding commit / settle evidence
- Recovery actions allow two types:
  - Mark as `orphaned` and enter human audit
  - Safely delete and output audit record
- `unsourcedRecordCount` only serves as observation metric, does not replace WAL recovery.

## Results

- Cost ledger crash recovery no longer stays at comment layer.

## Related Implementation

- `src/platform/five-plane-control-plane/cost-alert/*`
- `src/ops-maturity/cost-optimizer/*`