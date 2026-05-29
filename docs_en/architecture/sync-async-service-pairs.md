# Sync/Async Service Pair Boundaries

This document clarifies the uncertainty around "sync/async service pairs potentially containing dead code" identified in reviews.

## Conclusion

- `human-takeover-service.ts` is the synchronous state and action implementation; `human-takeover-service-async.ts` is the async orchestration layer with queuing, timeout, escalation, and event emission.
- `execution-dispatch-service.ts` is the dispatch core implementation; `execution-dispatch-service-async.ts` is the async facade used by `runtime-factory`.
- `execution-worker-handshake-service.ts` is the handshake core implementation; `execution-worker-handshake-service-async.ts` is the async facade used by `runtime-factory`.
- `execution-worker-writeback-service.ts` is the writeback core implementation; `execution-worker-writeback-service-async.ts` is the async facade used by `runtime-factory`.

## Judgment Rules

- The sync file must be depended on by the corresponding async file, indicating that async is not a parallel rewrite but wraps the existing authoritative implementation.
- The sync file must still be called by other `src/` code, indicating it is not an orphan implementation kept only for the async facade.
- The async file must still be called by other `src/` code, indicating it is not a dead wrapper layer covered only by tests.
- Both sides must have targeted tests to prevent "references exist but no regression protection".

## Solidified Audit

- Audit script: `node scripts/ci/audit-sync-async-service-pairs.mjs`
- Currently covered service pairs in review:
  - `human-takeover-service.ts` / `human-takeover-service-async.ts`
  - `execution-dispatch-service.ts` / `execution-dispatch-service-async.ts`
  - `execution-worker-handshake-service.ts` / `execution-worker-handshake-service-async.ts`
  - `execution-worker-writeback-service.ts` / `execution-worker-writeback-service-async.ts`

If the sync core is later migrated to a truly async implementation, the old file should be deleted synchronously and this audit script updated, rather than letting both implementations coexist long-term and lose boundary descriptions.