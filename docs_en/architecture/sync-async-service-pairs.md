# Sync/Async Service Pair Boundary

This document is used to close the uncertainty in the review about "sync/async service pairs may have dead code".

## Conclusion

- `human-takeover-service.ts` is the synchronous state and action implementation; `human-takeover-service-async.ts` is the async orchestration layer with queuing, timeout, escalation, and event emission.
- `execution-dispatch-service.ts` is the dispatch core implementation; `execution-dispatch-service-async.ts` is the async facade used by `runtime-factory`.
- `execution-worker-handshake-service.ts` is the handshake core implementation; `execution-worker-handshake-service-async.ts` is the async facade used by `runtime-factory`.
- `execution-worker-writeback-service.ts` is the writeback core implementation; `execution-worker-writeback-service-async.ts` is the async facade used by `runtime-factory`.

## Decision Rules

- Sync files must be depended on by the corresponding async files, indicating that async is not a parallel rewrite but wraps the existing authoritative implementation.
- Sync files must still be called by other `src/` files, indicating they are not orphan implementations reserved only for the async facade.
- Async files must still be called by other `src/` files, indicating they are not dead wrapper layers covered only by tests.
- Both sides must have directional tests to prevent "referenced but without regression protection".

## Solidified Audit

- Audit script: `node scripts/ci/audit-sync-async-service-pairs.mjs`
- Currently covered review-pointed service pairs:
  - `human-takeover-service.ts` / `human-takeover-service-async.ts`
  - `execution-dispatch-service.ts` / `execution-dispatch-service-async.ts`
  - `execution-worker-handshake-service.ts` / `execution-worker-handshake-service-async.ts`
  - `execution-worker-writeback-service.ts` / `execution-worker-writeback-service-async.ts`

If the sync core is later completely migrated to a true async implementation, the old file should be deleted synchronously and this audit script updated, rather than letting two sets of implementations coexist long-term and lose boundary explanation.