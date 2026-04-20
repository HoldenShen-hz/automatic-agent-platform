# Operations Checklist

> 本文件整合 `docs_zh/operations/` 下的所有清单类文档。
> 由 `research/reference-alignment/reference_cross_analysis_and_todolist.md` 的任务 9A 整合生成。

## 1. 发布就绪清单（Pre-Launch Top 20 Hard Checklist）

来源: `pre_launch_top20_hard_checklist.md`

### P0 — 生产阻断项（必须全部完成）

| # | 检查项 | 验证方式 |
|---|--------|----------|
| 1 | `npm run build` 无错误 | 本地 build |
| 2 | `npm run typecheck` 零错误 | 本地 typecheck |
| 3 | `npm run test` 全量通过 | 本地测试（实际测试数见 `project_progress_tracker.md` 最新值） |
| 4 | 所有 webhook 走签名验证 | 代码审查 |
| 5 | `authService` 为空时拒绝启动，不默认信任请求头 | 代码审查 |
| 6 | 所有密钥比较使用 `timingSafeEqual` | `grep` 搜索 |
| 7 | 所有 POST 路由接 Zod schema 校验 | 代码审查 |
| 8 | HTTP body 大小有限制（≤1MB 公共 API） | 代码审查 |
| 9 | 无 SQL 注入风险（参数化查询） | 代码审查 |
| 10 | fork bomb / shell 注入防护激活 | 安全测试 |
| 11 | SSRF guard 对所有出站 URL 生效 | 代码审查 |
| 12 | 多租户隔离 — 所有查询带 `tenant_id` | 代码审查 |
| 13 | WAL 模式 SQLite 有备份流程 | 脚本验证 |
| 14 | Graceful shutdown 能在 15s 内完成子进程清理 | 实际测试 |
| 15 | 定时器泄漏问题清零 | 测试验证 |
| 16 | `global setup/teardown` 能检测 zombie process | 测试验证 |
| 17 | Docker 使用 tini 作为 PID 1 | Dockerfile 审查 |
| 18 | CI 包含 lint / test / coverage / audit | CI 配置审查 |
| 19 | `.env` 不提交到 git | `git status` 检查 |
| 20 | `/healthz` 端点返回 DB + Provider 状态 | curl 测试 |

### P1 — 生产质量项（目标，但不阻断发布）

| # | 检查项 |
|---|--------|
| 21 | ESLint 无 critical/warning（core 路径） |
| 22 | 所有 CLI 统一 bootstrap/teardown 模式 |
| 23 | Structured logger 支持 JSONL 文件输出 |
| 24 | AsyncLocalStorage traceId 上下文注入 |
| 25 | Node 20/22 CI matrix 全绿 |

---

## 2. Pre-Coding Checklist

来源: `pre_coding_checklist.md`

新功能或重构开始前，必须确认：

### 范围与设计

- [ ] 有对应的 issue 或 ADR
- [ ] ADR 已评审并接受（如果涉及核心契约变更）
- [ ] 影响范围已评估（影响哪些模块、哪些测试）
- [ ] 已有向后兼容策略，或明确不兼容已标记为 breaking change
- [ ] 涉及 schema 变更已有迁移脚本

### 代码质量

- [ ] TypeScript strict mode 合规
- [ ] 无 `as unknown as` 新增（类型安全规则）
- [ ] 无裸 `console.log`（使用 StructuredLogger）
- [ ] 无直接 `process.env`（通过 config loader）
- [ ] 公共 API 有类型签名
- [ ] 错误码符合 `error_code_registry_contract.md` 规范

### 测试

- [ ] 有对应的单元测试文件
- [ ] 有对应的集成测试（如果涉及跨模块）
- [ ] 测试通过 `npm run test` 验证

---

## 3. Documentation Completion Gate

来源: `documentation_completion_gate.md`

核心模块完成前必须完成的文档：

| 模块 | 必须文档 |
|------|---------|
| 新增 API 路由 | 更新 `docs_zh/contracts/api_surface_contract.md` 或相关 API contract |
| 新增 Schema 变更 | 更新 `docs_zh/contracts/storage_schema_contract.md` |
| 新增事件类型 | 更新 `docs_zh/contracts/event_bus_contract.md` 或对应事件 contract |
| 新增安全机制 | 更新 `docs_zh/contracts/sandbox_and_auth_contract.md` |
| 新增 provider | 更新 `docs_zh/contracts/tool_and_provider_execution_contract.md` |
| 新增 workflow 类型 | 更新 `docs_zh/contracts/task_and_workflow_contract.md` |
| 新增 contract | 必须创建 `docs_zh/contracts/<name>_contract.md` |

---

## 4. Release Readiness Checklist

来源: `release_readiness_checklist.md`

完整版本发布前必须通过，见 [../quality/01-release-checklist.md](../quality/01-release-checklist.md)。

---

## 5. 文档维护规则

- 所有清单更新后，同步更新本文件对应章节
- 大版本发布前必须完成"Pre-Launch Top 20 Hard Checklist"
- Pre-coding checklist 应在每个 PR 的 reviewer 清单中引用
- 文档完成 gate 作为模块 Merge 的必要条件
