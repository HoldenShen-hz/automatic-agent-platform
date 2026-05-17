# 项目全面清理审查

**日期**: 2026-05-17
**范围**: 完整项目扫描 (排除 src/, dist/, node_modules/, .git/)
**目的**: 识别临时文件、缓存、重复文件和历史文件以便清理

---

## 1. 内存数据库文件 (`:memory:`)

**位置**: 项目根目录 (`:memory:*`)
**模式**: `aa-truth-append-*`, `aa-truth-cost-*`, `aa-truth-exec-*`, `aa-truth-session-*`, `aa-truth-status-*`, `aa-truth-wf-*`
**数量**: 56 个文件 × ~2.1MB = **~120MB**
**日期**: 2026年5月8-17日
**状态**: 全部过期 - 测试中断产生的临时文件

```bash
rm -f /Users/holden/Project/automatic_agent/automatic_agent_platform/:memory:*
```

---

## 2. `.tmp/` 目录 - 性能测试数据库

**位置**: `.tmp/`
**数量**: 295 个文件 + 子目录
**大小**: **~1.2GB**
**包含**:
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

**状态**: 全部过期 - 性能/日志测试产物

```bash
rm -rf /Users/holden/Project/automatic_agent/automatic_agent_platform/.tmp/
```

---

## 3. `.test-db/` 目录 - 测试数据库

**位置**: `.test-db/`
**数量**: 2946 个项目 (文件 + 目录)
**大小**: **~94MB**
**包含**:
- `happy-path-records-*.db` + `-shm` + `-wal`
- `checkpoint-perf-*.db`
- `multi-step-*/` (30+ 会话目录)
- `multi-step-retry-*.db`

**状态**: 全部过期 - 测试产物

```bash
rm -rf /Users/holden/Project/automatic_agent/automatic_agent_platform/.test-db/
```

---

## 4. `.aa-tool-artifacts/` 目录

**位置**: `.aa-tool-artifacts/`
**数量**: 676 个产物目录
**大小**: **~116MB**
**包含**: `multi-step/artifact_*/call_*-git.log` 文件
**状态**: 工具执行日志 - 删除前需审查

```bash
# 确认后执行:
rm -rf /Users/holden/Project/automatic_agent/automatic_agent_platform/.aa-tool-artifacts/
```

---

## 5. 测试会话回放包 (tests/unit/**/session-replay/)

**位置**: `tests/unit/core/runtime/orchestrator/session-replay/`, `tests/unit/runtime/session-replay/`, `tests/unit/platform/execution/execution-engine/session-replay/`
**数量**: 100+ 个 `.jsonl` 文件
**最大文件**:
- `task-bundle_qa_single_step-sessions.jsonl` (36MB, 35MB, 28MB)
- `task-bundle_single_agent_minimal-sessions.jsonl` (9.7MB, 9.5MB)
- `task-bundle_oapeflir_Many_Steps_Test-sessions.jsonl` (4.4MB)
- `task-bundle_single_division_multi_step_orchestration-sessions.jsonl` (3.9MB, 3.3MB)
**状态**: 测试录制 - 可能需要用于回放测试

**建议**: 保留最近 5-10 个，其余归档或清理

---

## 6. `.runtime/` 目录

**位置**: `.runtime/`
**大小**: ~36KB
**包含**:
- `governance-console.sqlite` (32KB) - 4月24日
- `quality.md` (3KB) - 5月17日
- `delegation/` 子目录

**状态**: 运行时产物 - 删除前需审查

---

## 7. `.audit/` 目录

**位置**: `.audit/`
**包含**: `delegation/`, `quality.md`, `clamped-files.log` (69KB)
**状态**: 审计产物 - 删除前需审查

---

## 8. `logs/` 目录

**位置**: `logs/`
**包含**: `clamped-files.log` (69KB)
**状态**: 应用日志 - 历史记录

---

## 9. `tests/performance.bak/` - 备份文件

**位置**: `tests/performance.bak/`
**数量**: 10 个 `.bak` 文件 (~55KB)
**文件**:
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

**状态**: 可安全删除 - 旧备份

```bash
rm -rf /Users/holden/Project/automatic_agent/automatic_agent_platform/tests/performance.bak/
```

---

## 10. `data/runtime/` 目录

**位置**: `data/runtime/`
**包含**:
- `api-server.nohup.log` (0 bytes) - 空文件
- `api-server.sqlite` (1.9MB) - 4月23日

**状态**: 运行时数据 - 删除前需审查 (可能是过期的开发数据)

---

## 11. `dist_issue2014/` 目录

**位置**: `dist_issue2014/`
**大小**: 完整的重复构建输出
**包含**: 构建的 JS/DTS/JS.map 文件 + `.test-db/`
**日期**: 2026年5月12日
**状态**: issue #2014 修复的重复构建产物

```bash
rm -rf /Users/holden/Project/automatic_agent/automatic_agent_platform/dist_issue2014/
```

---

## 12. 覆盖率报告

**位置**: `coverage/`
**包含**:
- `coverage-final.json` (20MB)
- `lcov.info` (2.5MB)

**建议**: 确保已在 `.gitignore` 中，可通过 `npm run test:coverage` 重新生成

---

## 13. 大型文档文件

**文件** (超过 1MB):
| 文件 | 大小 |
|------|------|
| `docs_zh/reviews/architecture-design-review.md` | 3.0MB |
| `docs_zh/reviews/platform-architecture-implementation-consistency-audit_round_reaudit.md` | 2.2MB |
| `docs_en/reviews/architecture-design-review.md` | ~2.2MB |
| `docs_en/reviews/platform-architecture-implementation-consistency-audit_round_reaudit.md` | ~2.3MB |

**状态**: 这些是审查文档 - 虽然很大但是合法的

---

## 14. 归档目录

**位置**: `docs_zh/architecture/archive/`
**包含**: `00-platform-architecture-monolith-2026-05-14.md`
**状态**: 历史归档 - 确认是否还需要

---

## 15. `.DS_Store` 文件

**位置**: 根目录, `src/`, `docs_zh/`
**数量**: 3 个文件
**状态**: 可安全删除

```bash
find /Users/holden/Project/automatic_agent/automatic_agent_platform -name ".DS_Store" -delete
```

---

## 16. 文档重复/缺失对比

### 仅在 docs_zh/ 中的文件 (不在 docs_en/):
- `docs_zh/architecture/archive/00-platform-architecture-monolith-2026-05-14.md`
- `docs_zh/operations/archive/current_todo_list-history-2026-05-14.md`
- `docs_zh/reviews/extract-issues.mjs` (JS 脚本, 不需要翻译)

### 仅在 docs_en/ 中的文件 (英文独有):
- `docs_en/adr/109-v4.3-contract-freeze.md`
- `docs_en/architecture/v3.0-domain-research.md`
- `docs_en/contracts/events_and_checkpoints_contract.md`
- `docs_en/contracts/smtp_contract.md`
- `docs_en/contracts/v4_3_*` (11 个 v4.3 合约文件)
- `docs_en/quality/00-full-coverage-test-manual-append.md`
- 以及 `docs_en/migration/`, `docs_en/migrations/`, `docs_en/domains/` 中的 README

### 完全相同的文件 (字节对字节重复):
- `docs_zh/migrations/e2e-workflow-state-migration.md` = `docs_en/migrations/` 版本
- `docs_zh/operations/test_coverage_baseline_gate.md` = `docs_en/` 版本
- `docs_zh/reviews/platform-architecture-implementation-consistency-audit_round.md` = `docs_en/` 版本

---

## 17. 源代码发现 (src/)

**重导出包装模式** 在 `scale-ecosystem/marketplace/`:
- `tenant-platform-service-async.ts` → `runtime-services/`
- `execution-worker-handshake-service-async.ts` → `runtime-services/`
- `billing-service-async.ts` → `billing/`
- 另有 9+ 个类似文件

**小型桶文件存根** (38 个 `index.ts` 文件，小于 ~50 字节):
- 模式: 单行重导出
- 位置: `platform/five-plane-*/`, `platform/shared/`, `scale-ecosystem/`, `ops-maturity/`

**状态**: 这些是架构模式，不是需要删除的重复文件

---

## 建议删除汇总

| 类别 | 大小 | 可安全删除 | 命令 |
|------|------|-----------|------|
| `:memory:*` 文件 | ~120MB | 是 | `rm -f :memory:*` |
| `.tmp/` | ~1.2GB | 是 | `rm -rf .tmp/` |
| `.test-db/` | ~94MB | 是 | `rm -rf .test-db/` |
| `tests/performance.bak/` | 55KB | 是 | `rm -rf tests/performance.bak/` |
| `dist_issue2014/` | ~MB | 是 | `rm -rf dist_issue2014/` |
| `.DS_Store` | 18KB | 是 | `find . -name ".DS_Store" -delete` |
| `.aa-tool-artifacts/` | ~116MB | 需审查 | (保留用于产物分析) |
| `.runtime/` | 36KB | 需审查 | (可能需要) |
| `.audit/` | 70KB | 需审查 | (可能需要) |
| `logs/` | 70KB | 需审查 | (可能需要) |
| `data/runtime/` | 1.9MB | 需审查 | (可能包含开发数据) |

**可安全删除总计**: ~1.4GB+
**需审查后删除**: ~118MB

---

## 不要删除

- `.env`, `.env.example`
- `.git/`, `.github/`, `.husky/`, `.claude/`
- `src/` (源代码)
- `dist/` (构建输出)
- `node_modules/`
- `docs_zh/`, `docs_en/` (文档)