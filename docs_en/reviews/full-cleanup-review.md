# Project Cleanup Review - All Files

**Date**: 2026-05-17
**Scope**: Full project scan (excluding src/, dist/, node_modules/, .git/)
**Purpose**: Identify temporary, cache, duplicate, and historical files for cleanup

---

## 1. In-Memory Database Files (`:memory:`)

**Location**: Project root (`:memory:*`)
**Pattern**: `aa-truth-append-*`, `aa-truth-cost-*`, `aa-truth-exec-*`, `aa-truth-session-*`, `aa-truth-status-*`, `aa-truth-wf-*`
**Count**: 56 files × ~2.1MB = **~120MB**
**Date**: May 8-17, 2026
**Status**: All STALE - test artifacts from interrupted runs

```bash
rm -f /Users/holden/Project/automatic_agent/automatic_agent_platform/:memory:*
```

---

## 2. `.tmp/` Directory - Performance Test Databases

**Location**: `.tmp/`
**Count**: 295 files + subdirectories
**Size**: **~1.2GB**
**Contains**:
- `event-bus-throughput-*.db` (14MB, 12MB)
- `event-bus-latency-*.db` (9.6MB, 6.5MB)
- `exec-throughput-perf-*.db` (9.5MB)
- `memory-retrieval-perf-*.db` (2.9MB)
- `dispatch-perf-*.db`
- `checkpoint-perf-*.db`
- `state-transition-perf-*.db`
- `concurrency-*.db` (6.2MB)
- `worker-registry-perf-*.db` (3.1MB)
- `aa-logger-blocking-*/test.log`
- `aa-logger-concurrent-*/concurrent.log`
- `aa-logger-highfreq-*/highfreq.log`
- `artifact-perf-*/`
- `session-replay/`

**Status**: All STALE - performance/logger test artifacts

```bash
rm -rf .tmp/
```

---

## 3. `.test-db/` Directory - Test Databases

**Location**: `.test-db/`
**Count**: 2946 items (files + directories)
**Size**: **~94MB**
**Contains**:
- `happy-path-records-*.db` + `-shm` + `-wal`
- `checkpoint-perf-*.db`
- `multi-step-*/` (30+ session directories)
- `multi-step-retry-*.db`

**Status**: All STALE - test artifacts

```bash
rm -rf .test-db/
```

---

## 4. `.aa-tool-artifacts/` Directory

**Location**: `.aa-tool-artifacts/`
**Count**: 676 artifact directories
**Size**: **~116MB**
**Contains**: `multi-step/artifact_*/call_*-git.log` files
**Status**: Tool execution logs - review before deleting

```bash
# Review first, then:
rm -rf .aa-tool-artifacts/
```

---

## 5. Session Replay Test Bundles (tests/unit/**/session-replay/)

**Location**: `tests/unit/core/runtime/orchestrator/session-replay/`, `tests/unit/runtime/session-replay/`, `tests/unit/platform/execution/execution-engine/session-replay/`
**Count**: 100+ `.jsonl` files
**Largest**:
- `task-bundle_qa_single_step-sessions.jsonl` (36MB, 35MB, 28MB)
- `task-bundle_single_agent_minimal-sessions.jsonl` (9.7MB, 9.5MB)
- `task-bundle_oapeflir_Many_Steps_Test-sessions.jsonl` (4.4MB)
- `task-bundle_single_division_multi_step_orchestration-sessions.jsonl` (3.9MB, 3.3MB)
**Status**: Test recordings - may be needed for replay tests

**Recommendation**: Keep most recent 5-10, archive or prune older ones

---

## 6. `.runtime/` Directory

**Location**: `.runtime/`
**Size**: ~36KB
**Contains**:
- `governance-console.sqlite` (32KB) - Apr 24
- `quality.md` (3KB) - May 17
- `delegation/` subdirectory

**Status**: Runtime artifacts - review before deleting

---

## 7. `.audit/` Directory

**Location**: `.audit/`
**Contains**: `delegation/`, `quality.md`, `clamped-files.log` (69KB)
**Status**: Audit artifacts - review before deleting

---

## 8. `logs/` Directory

**Location**: `logs/`
**Contains**: `clamped-files.log` (69KB)
**Status**: Application log - historical

---

## 9. `tests/performance.bak/` - Backup Files

**Location**: `tests/performance.bak/`
**Count**: 10 `.bak` files (~55KB)
**Files**:
- `api-load.test.ts.bak`
- `capacity-limits.test.ts.bak`
- `event-bus-throughput.test.ts.bak`
- `knowledge-perf.test.ts.bak`
- `memory-retrieval-latency.test.ts.bak`
- `oapeflir-perf.test.ts.bak`
- `plugin-perf.test.ts.bak`
- `provider-load.test.ts.bak`
- `runtime-throughput.test.ts.bak`
- `storage-query-baseline.test.ts.bak`

**Status**: Safe to delete - old backups

```bash
rm -rf tests/performance.bak/
```

---

## 10. `data/runtime/` Directory

**Location**: `data/runtime/`
**Contains**:
- `api-server.nohup.log` (0 bytes) - empty
- `api-server.sqlite` (1.9MB) - Apr 23

**Status**: Runtime data - review before deleting (may be stale dev data)

---

## 11. `dist_issue2014/` Directory

**Location**: `dist_issue2014/`
**Size**: Complete duplicate build output
**Contains**: Built JS/DTS/JS.map files + `.test-db/`
**Date**: May 12, 2026
**Status**: Duplicate build artifact from issue #2014 fix

```bash
rm -rf dist_issue2014/
```

---

## 12. Coverage Reports

**Location**: `coverage/`
**Contains**:
- `coverage-final.json` (20MB)
- `lcov.info` (2.5MB)

**Recommendation**: Add to `.gitignore` if not already, can regenerate with `npm run test:coverage`

---

## 13. Large Documentation Files

**Files** (over 1MB):
| File | Size |
|------|------|
| `docs_zh/reviews/architecture-design-review.md` | 3.0MB |
| `docs_zh/reviews/platform-architecture-implementation-consistency-audit_round_reaudit.md` | 2.2MB |
| `docs_en/reviews/architecture-design-review.md` | ~2.2MB |
| `docs_en/reviews/platform-architecture-implementation-consistency-audit_round_reaudit.md` | ~2.3MB |

**Status**: These are review documents - very large but legitimate

---

## 14. Archive Directories

**Location**: `docs_zh/architecture/archive/`
**Contains**: `00-platform-architecture-monolith-2026-05-14.md`
**Status**: Historical archive - consider if still needed

---

## 15. `.DS_Store` Files

**Locations**: Root, `src/`, `docs_zh/`
**Count**: 3 files
**Status**: Safe to delete

```bash
find . -name ".DS_Store" -delete
```

---

## 16. Duplicate/Missing Docs Comparison

### Files ONLY in docs_zh/ (not in docs_en/):
- `docs_zh/architecture/archive/00-platform-architecture-monolith-2026-05-14.md`
- `docs_zh/operations/archive/current_todo_list-history-2026-05-14.md`
- `docs_zh/reviews/extract-issues.mjs` (JS script, not translatable)

### Files ONLY in docs_en/ (English-only additions):
- `docs_en/adr/109-contract-freeze.md`
- `docs_en/architecture/v3.0-domain-research.md`
- `docs_en/contracts/events_and_checkpoints_contract.md`
- `docs_en/contracts/smtp_contract.md`
- `docs_en/contracts/v4_3_*` (11 v4.3 contract files)
- `docs_en/quality/00-full-coverage-test-manual-append.md`
- Plus READMEs in `docs_en/migration/`, `docs_en/migrations/`, `docs_en/domains/`

### Identical Files (byte-for-byte duplicates):
- `docs_zh/migrations/e2e-workflow-state-migration.md` = `docs_en/migrations/` version
- `docs_zh/operations/test_coverage_baseline_gate.md` = `docs_en/` version
- `docs_zh/reviews/platform-architecture-implementation-consistency-audit_round.md` = `docs_en/` version

---

## 17. Source Code Findings (src/)

**Re-export wrapper pattern** in `scale-ecosystem/marketplace/`:
- `tenant-platform-service-async.ts` → `runtime-services/`
- `execution-worker-handshake-service-async.ts` → `runtime-services/`
- `billing-service-async.ts` → `billing/`
- Plus 9 more similar files

**Small barrel-file stubs** (38 `index.ts` files under ~50 bytes):
- Pattern: single re-export line
- Locations: `platform/five-plane-*/`, `platform/shared/`, `scale-ecosystem/`, `ops-maturity/`

**Status**: These are architectural patterns, NOT duplicates to delete

---

## Summary - Recommended Deletion

| Category | Size | Safe to Delete | Command |
|----------|------|---------------|---------|
| `:memory:*` files | ~120MB | YES | `rm -f :memory:*` |
| `.tmp/` | ~1.2GB | YES | `rm -rf .tmp/` |
| `.test-db/` | ~94MB | YES | `rm -rf .test-db/` |
| `tests/performance.bak/` | 55KB | YES | `rm -rf tests/performance.bak/` |
| `dist_issue2014/` | ~MB | YES | `rm -rf dist_issue2014/` |
| `.DS_Store` | 18KB | YES | `find . -name ".DS_Store" -delete` |
| `.aa-tool-artifacts/` | ~116MB | REVIEW | (keep for artifact analysis) |
| `.runtime/` | 36KB | REVIEW | (may be needed) |
| `.audit/` | 70KB | REVIEW | (may be needed) |
| `logs/` | 70KB | REVIEW | (may be needed) |
| `data/runtime/` | 1.9MB | REVIEW | (may contain dev data) |

**Total Safe to Delete**: ~1.4GB+
**Total Review Before Deleting**: ~118MB

---

## Do NOT Delete

- `.env`, `.env.example`
- `.git/`, `.github/`, `.husky/`, `.claude/`
- `src/` (source code)
- `dist/` (build output)
- `node_modules/`
- `docs_zh/`, `docs_en/` (documentation)
