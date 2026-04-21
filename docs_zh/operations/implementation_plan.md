# Implementation Plan

> ⚠️ **结构迁移说明** - 本文档引用旧结构 `src/core/`、`src/cli/`、`src/gateway/`。
> 当前代码库已迁移至 `src/platform/` 五层结构 + 上层业务域 (`domains/`、`interaction/`、`ops-maturity/` 等)。
> 本文档的计划内容可能需要对照 [architecture/README.md](../architecture/README.md) 重新核实执行状态。

## 目标

在不动摇现有文档结构的前提下，按 Phase 1a -> 1b -> 2a -> 2b -> 2c -> 3 -> 4 的顺序推进实现与产品化。

执行原则补充：

- `Phase 1a` 只做单 Agent 稳定运行。
- `Phase 1b` 只做单事业部工作流与最小编排。
- 完整多 Agent 平台化能力在 `Phase 2` 再逐步引入。
- 远程协调、Marketplace、多租户不允许在 `Phase 1a / 1b` 抢跑。
- `research/analysis` 中出现的新推荐项，必须先进入 [../migration/01-migration-scope.md](../migration/01-migration-scope.md) 的迁移边界判断，再决定是吸收到正式方案、后置到后续阶段，还是明确拒绝。

## 统一执行口径

这 4 份执行文档使用同一套口径：

| 文档 | 角色 | 回答的问题 | 是否事实源 |
| --- | --- | --- | --- |
| `implementation_plan.md` | 阶段与范围主计划 | 现在允许做哪个阶段、该阶段做什么、不做什么 | `是` |
| `operations-roadmap.md` | 开发顺序与依赖 | 先做哪一批、哪些能并行、退出门槛是什么 | `是` |
| `project_progress_tracker.md` | 实际项目进度 | 现在做到哪了、哪些完成、哪些阻塞 | `是` |

统一状态语义：

| 状态 | 含义 |
| --- | --- |
| `not_started` | 尚未进入该阶段或批次 |
| `ready` | 已通过 gate，可开始，但尚未开工 |
| `in_progress` | 已开工，正在推进 |
| `blocked` | 已开工但存在阻断 |
| `done` | 已达到当前阶段验收线 |

补充说明：

- `工作包 done` 不自动等于 `阶段关闭 done`。
- 若某阶段的开发工作包已完成，但阶段关闭证据被显式延期，例如 `24h / 72h` 长时验证，则应分别记录“开发工作包完成”和“阶段签收仍在进行中”。
- 外部研究结论不允许直接跳过吸收矩阵进入实现；必须先通过 `research_analysis_absorption_matrix.md` 映射到 roadmap / backlog / contract / phase。
- 参考型结论也必须走同一规则：先写明 `adopted / adapted / not_adopted`，再允许进入正式实现。当前边界结论见 [../migration/01-migration-scope.md](../migration/01-migration-scope.md)。

统一更新规则：

1. 阶段边界、非目标、允许范围变化时，先改 `implementation_plan.md`。
2. 开发顺序、依赖、批次切换变化时，再改 `operations-roadmap.md`。
3. 实际状态变化后，更新 `project_progress_tracker.md`。
4. 当前短期活跃事项统一收敛到 `project_progress_tracker.md` 的当前状态区。
5. 若 3 份文档有冲突，以“范围 -> 顺序 -> 进度”的优先级判定。
6. 若研究分析结论与当前方案冲突，以 [../migration/01-migration-scope.md](../migration/01-migration-scope.md) 与当前平台架构文档为准，再回写正式方案。

## 开工前门槛

开始任何阶段实现前必须满足：

- `operations/operations-checklist.md` 已通过当前阶段的文档签收。
- `operations/operations-checklist.md` 中适用项已经通过。
- `operations/operations-checklist.md` 中属于当前阶段的模块验收项已明确并可验证。
- `project_progress_tracker.md` 与 `operations/operations-checklist.md` 中无阻断当前阶段的 P0 文档缺口。
- 若当前阶段目标含”可稳定运行”，则 `project_progress_tracker.md` 与 `operations/operations-checklist.md` 已纳入执行基线。

## 当前执行顺序

在进入代码实现前，优先按 [operations-roadmap.md](./operations-roadmap.md) 的前 20 项收紧底座。
若目标是先达到”可稳定运行”，则优先按 [operations-roadmap.md](./operations-roadmap.md) 的三批顺序推进。
若新增外部参考或对比分析结论，则优先按 [../migration/01-migration-scope.md](../migration/01-migration-scope.md) 做吸收判定，再改 roadmap / backlog / phase 顺序。

## 当前实现批次

当前 revision 锁定到：

- 当前阶段：`Phase 1a Evidence`
- 当前阶段状态：`in_progress`
- 当前开发批次：`Phase 1a Evidence`
- 当前批次状态：`in_progress`
- 当前短期工作包：`P1A-EVID-24` 已完成并生成正式 evidence bundle；当前主线切到 `P1A-EVID-72` 72h 长时证据。phase1-4 对应 `opeli_detailed_design.md §K` 的文档同步已经完成，当前剩余工作是 `P1A-EVID-72` 长时证据，以及正式纳入执行面的工业级 P0/P1/P2 program（见 `current_todo_list.md`）。`Phase 3` 的 `P3-01` PMF 指标验证、`P3-02` 收费能力、`P3-03` 感知 MVP、`P3-04` Web/API 产品化、`REF-HERMES-01` gateway target directory、`REF-HERMES-02` memory provider seam、`REF-HERMES-03` provider credential pool、`REF-HERMES-04` conservative model routing、`REF-HERMES-05` shadow snapshot rollback、`REF-HERMES-06A` 工具名模糊匹配、`REF-HERMES-06B` 工具参数安全矫正、`REF-HERMES-07` turn-scoped fallback 自动恢复、`REF-HERMES-08` 上下文文件安全扫描、`REF-HERMES-09` profile 多实例隔离、`REF-HERMES-10` prompt 静态/动态分区缓存，`Phase 4` 的 `P4-01 / P4-02`、`UI-01` console / cockpit program，以及 `PLATFORM-01A / PLATFORM-01B / PLATFORM-01C / IND-01A / IND-01B / IND-01C` 均已完成；本轮又完成五层工业级治理联动切片：一是 `INTENT-01 / IND-P0-08`，把 `IntakeRouter` 升级为支持 8 类 intent / continuation / confidence 的 structured routing，并把 `LlmEvalService` 升级为 deterministic structured CI gate 与 baseline prompt regression；二是 `IND-P0-08 / IND-P1-03`，新增 `PromptModelPolicyGovernanceService`，支持 prompt/model/policy release 注册、统一 governance gate、rollback target、governance snapshot 与模型失败 `degrade_to_fallback` 决策；三是把 eval/governance 表纳入 SQLite migration 31，并将 governance snapshot 真实接入 `model-routing` runtime/CLI fallback；四是 `IND-P1-04 / IND-P1-05 / IND-P1-06 / IND-P1-07`，新增 `EnterpriseGovernanceService` / CLI，把 incident handoff persistence、schema compatibility gate、package-lock SBOM / dependency policy scan 与 Datadog / Grafana / OTel payload bundle 导出收口为统一 evidence package；五是 `IND-P1-08 / IND-P1-09 / IND-P1-10`，新增真实 Telegram/Slack/webhook gateway adapter、API key -> bearer token exchange + HS256 JWT/RBAC/admin boundary、coordinator snapshot persistence + summary/select CLI/API。其中 `IND-P0-09` 已推进到真实 publish execute、release bundle/export ledger、release execution ledger 与 workflow receipt audit 基线，`IND-P0-10` 已推进到 environment overlay、deployment matrix、secret/config injection plan、deployment execution / promotion history ledger、workflow receipt audit 与 release execute 链式触发部署，`IND-P0-05` 已推进到 secret registry / usage audit / rotation event、env-backed provider seam，并已接入 `deployment-execution` 与 release pipeline 执行链，`IND-P0-01` 也已完成前十一轮 PostgreSQL 基线：先把 driver 配置、DSN、SSL、pool、dual-run 与 shadow SQLite path 的 fail-close 边界收紧，再补 doctor/CLI 的结构化 storage backend profile，随后补 authoritative storage backend factory seam 并把 `phase1a / phase1b` runtime 接到统一入口，接着补三批 CLI authoritative storage factory 接线、service signature decoupling、第八轮 `sql/sqlite` handle 分层、第九轮 CLI `storage.store` context 下沉、第十轮 generic `phase1a-store` / `authoritative-sql-database` facade import decoupling，以及第十一轮顶层 `sqlite-database` facade / authoritative import uplift；当选择 postgres driver 时，执行面会 truthfully fail-close，当前仅 `doctor` direct sqlite 与少数 sqlite-specific consumer 保留 concrete SQLite 例外。`IND-P1-08 / IND-P1-09` 当前已具可执行 baseline，`IND-P1-10` 当前则 truthfully 仍停留在 selection foundation，不等同于真正 multi-coordinator HA。

当前主线执行顺序：

1. `P1A-EVID-72` 72h 长时证据作为当前主线推进。
3. `IND-P0-09 / IND-P0-10 / IND-P0-05` 可在长时证据运行期间并行推进容器/CI、多环境部署与 secret 管理基线，但不得跳过证据任务的持续观测与回写。
4. `P1A-EVID-72` 完成后，立即进入工业级 `IND-P0` 主线，而不是宣称系统已全部完成。
5. `IND-P0` 收口后，继续推进 `IND-P1`；`IND-P1` 收口后，再推进 `IND-P2`。
6. 后续新增实现优先进入工业级 P0/P1/P2 program，而不是回退到已完成的 Hermes Delta 工作包。
7. 每个工作包都必须走完 `build -> targeted unit/integration -> sandbox/security -> npm test -> 文档回写`，不允许只做局部实现不做回归。

首批工作包定义：

| 工作包 ID | 名称 | 对应批次 |
| --- | --- | --- |
| `P1A-01` | 目录骨架 | `Week 1` |
| `P1A-02` | 核心类型与状态机骨架 | `Week 1` |
| `P1A-03` | SQLite schema 与 migration 骨架 | `Week 1` |
| `P1A-04` | 最小单 Agent happy path | `Week 1` |
| `P1A-05` | 事件分级、event bus、stream bridge 基线 | `Week 2` |
| `P1A-06` | tool executor 与 timeout / cancel / cleanup | `Week 2` |
| `P1A-07` | 最小 approval / policy / budget 守卫 | `Week 2` |
| `P1A-08` | inspect / health / structured log 基线 | `Week 2` |
| `P1A-09` | 恢复演练测试基线 | `Week 3` |
| `P1A-10` | golden tasks 与回归夹具 | `Week 4` |
| `P1A-11` | `24h / 72h` soak test 框架 | `Week 5` |

当前回写：

- `P1A-01` ~ `P1A-04` 已完成第一版骨架实现。
- `P1A-06` 已完成第一版 tool executor / timeout / cancel / cleanup 与 sandbox 测试。
- `P1A-05` ~ `P1A-08` 已完成 `Week 2` 基线。
- `P1A-09` 已完成 `Week 3` 的 startup consistency 与 recovery drill 基线。
- `P1A-10` 已完成 `Week 4` 的 golden tasks、timeline / diagnostics 与 doctor 自检基线。
- `P1A-11` 已完成 `Week 5` 的 stable validation 脚本与 soak test 框架。
- post-`Week 5` 的第一轮稳定化收口已完成：workflow static validator、admission control、stalled execution detection 与 doctor 集成已落地。
- `P1A-EVID-24` 已完成并生成正式 evidence bundle；`P1A-EVID-72` 现作为当前长时证据主线继续推进。
- `system_gap_analysis_20260412a.md` 中 `I-74 / I-79` 的当前 revision 收口已完成：主链事件 payload 已继续类型化，稳定性工具 canonical namespace 已统一到 `src/core/stability/`。
- 本轮还继续吸收了 5 份 reference：cache orchestration、staged agent team、validation-repair loop、memory plane 分层与 evolution 边界治理，相关实现与“不照搬”的理由已固定在 `reference_20260413_system_alignment_review.md`。
- `Phase 1a` 当前应理解为“开发工作包已完成，但阶段签收未关闭”；`Phase 1b` 当前应理解为“开发工作包已完成，阶段签收随整体稳定性与阶段策略继续推进”。
- `REF-HERMES-06B` 已完成：已落 `tool-argument-coercion` 模块、runtime middleware 接线与 `command_exec / question / todo_write / edit_replace` 服务边界安全矫正；高风险歧义参数保持 fail-closed，并完成 targeted unit / integration / sandbox-security / full `npm test` `1048/1048` 与 stable validation。
- `REF-HERMES-07` 已完成：已在 `model-routing-service.ts` 与 `model-routing` CLI 落地 turn-scoped fallback lease，同一 turn 内允许复用临时降级结果、下一 turn 默认自动恢复主 profile；完成 targeted unit / integration / sandbox-security / full `npm test` `1053/1053` 与 stable validation。
- `P1B-01` ~ `P1B-04` 已完成，`Phase 1b` 已进入最小编排实现阶段。
- `P1B-05 / P1B-06` 已完成，`P1B-07 / P1B-08` 也已完成，`Phase 1b` 的编码工作包已经收口。
- `P2A-01` ~ `P2A-10` 已完成，当前主线已补齐多事业部加载链、artifact lineage、artifact-aware diagnostics、runtime recovery repository / division recovery overview、dead-letter / recovery decision audit、recovery replay report / CLI、stable cross-division recovery drill、execution ticket / dispatch 基线、worker claim / heartbeat handshake，以及 authoritative worker writeback / completion handshake。
- `Week 6+` 的第一项 PG 语义预备已完成：SQLite migration ledger、checksum 校验、schema freshness gate，以及 startup / doctor fail-closed 集成已落地。
- `Week 6+` 的第二项 queue 语义预备已完成：dispatch reconciliation、orphan queue claim / terminal ticket repair，以及 `dispatch-reconcile` / `stable-dispatch-reconcile` CLI 已落地。
- `Week 6+` 的 `QUEUE-01` 当前切片已完成：已新增 `stable-queue-delivery` rehearsal / CLI，正式覆盖“queue replay 可由 authoritative DB truth 重建 dispatchable ticket”与“duplicate delivery 会被 worker capacity / lease fencing 拦截，并在 authoritative terminal writeback 后由 reconciliation 清理”两条演练语义；`stable-evidence` / `stable-gate` / `stable-package` 现已把 queue delivery 证据纳入生产前检查，并完成 build / targeted integration+CLI / sandbox/security / `npm test` `445/445` 全量回归。
- `Week 6+` 的 `DB-39` / PG migration compatibility 当前切片已完成：已新增 `stable-migration-compatibility` rehearsal / CLI，对 SQLite migration plan 做 PostgreSQL portability preflight；phase1a schema 中的 SQLite runtime `PRAGMA` 现已从 migration SQL 剥离到连接 bootstrap，migration ledger 也已兼容旧 checksum，避免现有库在 portability 收紧后被误判损坏；`stable-evidence` / `stable-gate` / `stable-package` 已正式纳入 migration compatibility 证据，并完成 build / targeted unit+integration+CLI / sandbox/security `44/44` / `npm test` `450/450` 全量回归。该切片仍是 portability preflight，不等同于 live PostgreSQL 执行验收。
- `Week 6+` 的 `DBQ-01` DB/queue disconnect drill 已完成：已新增 `stable-db-queue-disconnect` rehearsal / CLI，正式演练“queue unavailable 时 dispatch 显式 blocked 且不静默丢 ticket”“queue reconnect 后 missing dispatch ticket 可由 authoritative DB truth + agent execution plan metadata 重建”“authoritative worker writeback 在 DB 故障时返回 `authoritative_store_unavailable` 并 fail-close，恢复后可重试成功”三条语义；`stable-evidence` / `stable-gate` / `stable-package` 现已把 DB/queue disconnect 证据纳入生产前检查，并完成 build / targeted unit+runtime+evidence+gate+package+CLI / sandbox/security `49/49` / `npm test` `470/470` 全量回归。
- `Week 6+` 的 `DB-42` authoritative store writability fail-close drill 已完成：已新增 `stable-db-writability` rehearsal / CLI，正式演练“health 在 DB 不可写时进入 `read_only_operations_only`、doctor overall `fail_closed`”“phase1b intake admission fail-close，不接受需要 authoritative state 的新任务”“dispatch blocked 且 pending authoritative ticket 保留”三条语义；`stable-evidence` / `stable-gate` / `stable-package` 现已把 DB writability 证据纳入生产前检查，并完成 build / targeted unit+integration+CLI / sandbox/security `47/47` / `npm test` `475/475` 全量回归。
- `Week 6+` 的 `SCHED-03` dispatch affinity / load skew hotspot remediation 已完成：已新增 `worker-load-balancing` helper，把 active lease、saturation、tool backlog 与 CPU 收口为 load-aware dispatch score；health / doctor 现已补齐 sticky load skew 检测与 operator finding，热点 worker 即使 queue affinity 命中也会在有健康空闲容量时被主动降权；已完成 build / targeted unit+integration+CLI `113/113` / sandbox/security `44/44` / `npm test` `481/481` 全量回归。
- `Week 6+` 的 `SEC-36` tier_1 audit event integrity chain 已完成当前切片：已新增 tamper-evident 审计事件完整性链与 migration，tier_1 审计事件会在入库时写入 integrity ledger，doctor 新增 `audit_integrity` 自检并在 checksum / chain / missing event 异常时 `fail_closed`；已完成 build / targeted unit+integration+CLI `85/85` / sandbox/security `52/52` / `npm test` `485/485` 全量回归。
- `Phase 2b` 的 `MEM-05` memory repository / recall / quality baseline 当前切片已完成：已扩展 `memories` schema、落地 `MemoryService` / `memory` CLI，支持 scope/trust/lifecycle recall 过滤、命中计数、撤销与质量报告；runtime recovery dead-letter 路径也已自动写入 failure memory，形成最小 memory feedback 回路；已完成 build / targeted unit+integration+CLI `14/14` / sandbox/security `53/53` / `npm test` `491/491` 全量回归。
- `P3-01` 已完成：已落 PMF validation service、`pmf` CLI、report persistence/export、artifact evidence 与 division-scoped 验证报告，并完成 unit / integration / sandbox-security / full `npm test` `957/957` 与 `AA_VALIDATION_ITERATIONS=2 npm run validate:stable`。
- `P3-02` 已完成：已落 billing service、`billing` CLI、`billing_accounts / usage_events / quota_counters / ledger_entries / entitlement_decisions` 持久化、summary/export 闭环，并完成 unit / integration / CLI / sandbox-security、full `npm test` `964/964` 与 `AA_VALIDATION_ITERATIONS=2 npm run validate:stable`。
- `P3-03` 已完成：已落 legacy naming 的 `perception service` / `perception` CLI、`perception_sources / intel_items / intel_briefs / action_proposals` 持久化，以及 brief/proposal/export 闭环；当前文档语义已将其收口为 Observe-compatible product slice，并完成 unit / integration / CLI / sandbox-security、full `npm test` `969/969` 与 `AA_VALIDATION_ITERATIONS=2 npm run validate:stable`。
- `P3-04` 已完成：已落 Mission Control aggregate、版本化 HTTP API、最小 Web console、OpenAPI 文档与 `api` CLI，并完成 unit / integration / sandbox-security、full `npm test` `973/973` 与 `AA_VALIDATION_ITERATIONS=2 npm run validate:stable`。
- `REF-HERMES-01` 已完成：已落 gateway target directory、session-history fallback、canonical target resolve、`gateway-targets` CLI、版本化 API 与 console target directory，并完成 unit / integration / sandbox-security、full `npm test` `976/976` 与 `AA_VALIDATION_ITERATIONS=2 npm run validate:stable`。
- `REF-HERMES-02` 已完成：已落 built-in memory provider seam，支持 `initialize / system_prompt_block / prefetch / queue_prefetch / sync_turn / shutdown` 生命周期、FTS-safe prefetch、same-session experience filtering 与 `memory` CLI 扩展，并完成 unit / integration / sandbox-security、full `npm test` `981/981` 与 `AA_VALIDATION_ITERATIONS=2 npm run validate:stable`。
- `REF-HERMES-03` 已完成：已落 `provider-credential-pool.ts` 与 MiniMax cooldown/failover 治理，支持同 provider 多凭证轮换、`retry-after-ms` / `retry-after` / `reset_at` 统一 cooldown 语义，并完成 unit / integration / sandbox-security / full `npm test` 回归。
- `REF-HERMES-04` 已完成：已落 `model-routing-service.ts` 与 `model-routing` CLI，支持 conservative cheap-vs-strong route、sticky/preferred/pinned profile、provider health fallback 与 route trace，并完成 unit / integration / sandbox-security / full `npm test` `998/998`。
- `REF-HERMES-05` 已完成：已落 `shadow-snapshot-service.ts` 与 `shadow-snapshot` CLI，使用工作区外置 git metadata repo 提供 create/list/restore、常见生成目录排除、超大目录 fail-close 与 symlink/工作区内路径拒绝，并完成 unit / integration / sandbox-security / full `npm test` `1005/1005`。
- `PLATFORM-01C` 已完成：已落 `DataPlaneFlowService`、`data-plane` CLI、migration 25、analytics/archive/replay/movement job tenant-aware data plane flow，并完成 targeted unit / CLI / security、full `npm test` `1030/1030` 与 stable validation。
- `REF-HERMES-06A` 已完成：已落工具名 exact / alias / normalized / fuzzy unique 解析、correction trace 与 promote typo fail-close/修正可见性，并完成 targeted unit / security、full `npm test` `1035/1035` 与 stable validation。
- `P4-01` 已完成：已落 `enterprise-capability-matrix-service.ts` 与 `enterprise-capability` CLI，支持 environment readiness 注册、enterprise capability summary/export、JSON/Markdown 工件导出与 DB 持久化，并完成 unit / integration / sandbox-security / `npm run test:integration` `385/385` / full `npm test` `1011/1011` / `AA_VALIDATION_ITERATIONS=2 npm run validate:stable`。
- `Phase 2b` 的 `MEM-01` token estimation precision 当前切片已完成：已新增更精确 token estimator，优先消费 message parts / provider usage，并把 context compaction 的预算、trim / summarize 计数统一切换到新口径；tool result trim 后会按渲染内容重算，不再沿用粗糙 `chars/4`；已完成 build / targeted unit+integration `7/7` / sandbox/security `53/53` / `npm test` `495/495` 全量回归。
- `Phase 2b` 的 `MEM-02` STM -> LTM consolidation 当前切片已完成：已新增 memory consolidation，可在显式 boundary 内把满足阈值的 `layer_3` 记忆汇总为 `layer_5` 摘要记忆，并对源记忆做可审计撤销；`memory` CLI 已支持 `consolidate`，可稳定复现 consolidation 闭环；已完成 build / targeted unit+integration+CLI `12/12` / sandbox/security `54/54` / `npm test` `501/501` 全量回归。
- `Week 6+` 的第三项调度 explainability 预备已完成：dispatch decision trace、worker evaluation audit，以及 `dispatch:decision_recorded` 事件与 dispatch CLI / rehearsal 集成已落地。
- `Week 6+` 的第四项调度 observability 收口已完成：inspect / diagnostics / repro bundle / inspect CLI 已结构化暴露 dispatch decision traces，并补齐回归测试。
- `Week 6+` 的第五项 worker maintenance 语义已完成：worker registry / dispatch / handshake / writeback 已支持 `draining`，为无损维护与后续远程 worker 演进打底。
- `Week 6+` 的第六项版本与配置可见性已完成：doctor report 与 stable evidence bundle 已带 application/build/config/schema/flags 快照，补齐 `OPS-58` 基线。
- `Week 6+` 的第七项 worker heartbeat telemetry 已完成：worker snapshot / handshake / writeback 已带 cpu、memory、tool backlog、current step 与 last progress，doctor report 已汇总 stale worker 与 worker telemetry。
- `Week 6+` 的第八项 worker restart semantics 已完成：worker logical id、runtime instance id、restart chain 与 generation 已落盘，heartbeat / writeback / doctor / CLI 已具备 restart 审计语义。
- `Week 6+` 的第九项 `AGENT-21` agent execution record 已完成：dispatched worker execution 已落盘 plan / step / tool / decision / error / retry / restart 证据，并在 inspect / approval / CLI 暴露 execution evidence。
- `Week 6+` 的第十项 `SEC-33` 命令安全分类器闭环已完成：unknown command 已改为默认拒绝，命令分类结果带 TTL 缓存，command executor 的安全判定不再对未建模命令默认放行。
- `Week 6+` 的第十一项 `SEC-34` 配置篡改保护已完成：`config/`、`divisions/` 与 `AGENTS.md` 已建立受保护完整性 hash / drift 检测，并接入 doctor / sandbox/security / 全量回归。
- `Week 6+` 的第十二项 `DB-40` 存储配额已完成：artifact / debug / backup 目录已建立配额清点、最旧优先安全清理与 pin 白名单，并接入 doctor / sandbox/security / 全量回归。
- `Week 6+` 的 `TOOL-23` 当前切片已完成：builtin tool metadata contract validator 已落地，startup consistency 与 doctor 现会对 invalid tool contract 默认 fail-close，并完成 unit / integration / 全量回归。
- `Week 6+` 的 `AGENT-20` 当前切片已完成：execution resource ceiling guard 已对 `tool calls / memory footprint / elapsed time` 做运行时约束；skill execution、worker heartbeat/writeback 与 doctor 现已在超限时 fail-close 或降级暴露，并完成 unit / integration / sandbox/security / 全量回归。
- `Week 6+` 的 `AGENT-19` 当前切片已完成：doctor 现已在 stalled execution 检测基础上输出结构化 escalation package，汇总 trace / correlation、当前 step、runtime instance、warnings、incident root cause hints 与建议 operator action，并完成 unit / integration / sandbox/security / 全量回归。
- `Week 6+` 的 `SEC-32` 当前切片已完成：artifact store 现已在 text/json/markdown artifact 落盘前执行 secret redaction 与 injection 风险扫描；diagnostics export 返回值与最小复现导出文件也会同步脱敏，并完成 unit / integration / sandbox/security / 全量回归。
- `Week 6+` 的 `WF-16` 当前切片已完成：startup consistency checker 现已识别 workflow/task/session 终态不一致，runtime repair 会自动 reconcile task/session 终态，doctor 对该类不一致默认降级暴露，并完成 integration / sandbox/security / 全量回归。
- `Week 6+` 的 `OPS-55` 当前切片已完成：startup preflight 已补齐 config validation 与 default provider readiness fail-fast；doctor CLI 对坏配置、config symlink escape 与缺失 provider 凭据会直接 fail-close，并完成 unit / integration / CLI / sandbox/security / 全量回归。
- `Week 6+` 的 `AGENT-17` 当前切片已完成：session 生命周期边界已收紧，`awaiting_user` 不再允许再次 pause，terminated session 在 human takeover retry 与 runtime repair requeue 路径中不再被重开，而是创建新的 recovery session；startup consistency checker 与 runtime repair 现可识别并修复 active task 绑定 terminal session 的脏状态，并完成 unit / integration / sandbox/security / 全量回归。
- `Week 6+` 的 `DB-37` 当前切片已完成：SQLite 写事务现已把真实竞争写锁统一映射为稳定 `sqlite.write_contention` fail-close 错误；`stable-concurrency` 演练已新增 competing write scenario，验证竞争写不会污染已提交数据且竞争解除后可重新提交，并完成 unit / integration / CLI / 全量回归。
- `Week 6+` 的 `DB-38` 当前切片已完成：已新增 periodic orphan cleanup service 与 `orphan-cleanup` CLI，可关闭 orphan session、把 orphan claimed ticket 重新入队，并清理 worker snapshot 中失效的 `runningExecutions` 引用；完成 unit / integration / sandbox/security / 全量回归。
- `Week 6+` 的 `DB-39` 当前切片已完成：SQLite migration 现已按单 migration 事务化执行，失败时不会留下部分 schema / ledger 状态；legacy schema 自动升级与失败后修复重跑恢复用例已补齐，并完成 integration / sandbox/security / 全量回归。
- `Week 6+` 的 `DB-41` 当前切片已完成：SQLite 现已支持嵌套 savepoint 事务与一致性读事务；dispatch / writeback 等关键写路径已通过 repository authoritative aggregate 统一读取 execution/task/workflow/session，task snapshot 也已显式标注 `authoritative` consistency，并完成 unit / integration / sandbox/security / 全量回归。
- `Week 6+` 的 `SCHED-06` 当前切片已完成：stale execution repair 现会主动回收 stale lease ownership、同步清空 worker `runningExecutions` 占用，并在原 dispatch ticket 已 claimed 或缺失时补建 pending ticket，确保修复后具备 redispatch 路径；已完成 integration / sandbox/security / 全量回归。
- `Week 6+` 的 `SCHED-08` 当前切片已完成：dispatch 现已支持保守型优先级抢占 MVP，仅在 `urgent` ticket 命中“单并发 worker + 明确 resumable step 边界 + 低优先级 executing run”时回收旧 lease、把原 execution 置为 `blocked`、把 workflow 置为 `paused`、重建 pending ticket，并记录 `dispatch:execution_preempted` / `dispatch:ticket_requeued` 审计事件与 CLI/trace 可见性；已完成 build / targeted unit+integration+CLI / sandbox/security / 全量回归。
- `Week 6+` 的 `WF-13` 当前切片已完成：phase1a / phase1b 的 workflow step snapshot 现已统一为稳定 checkpoint 结构，包含 decision context、resume context 与 upstream artifact refs；runtime recovery view 已可直接暴露 latest checkpoint，并完成 unit / integration / sandbox/security / 全量回归。
- `Week 6+` 的 `WF-14` 当前切片已完成：workflow runtime 现已支持在 `step_started / tool_completed / before_commit` 注入 crash；phase1a / phase1b recovery drill 已验证 stale execution 检测、checkpoint 可见性与 repair closure，并完成 unit / integration / sandbox/security / 全量回归。
- `Week 6+` 的 `WF-15` 当前切片已完成：human takeover 现已支持手动设置 workflow `currentStepIndex` / `resumableFromStep` 与手动写入 step output，保留 operator action 审计、`workflow.step_completed` 事件与 workflow outputs 回写；`takeover` CLI 与多步 workflow 回归已补齐，并完成 integration / CLI / sandbox/security / 全量回归。
- `Week 6+` 的 `TOOL-24` Tool 超时与重试标准化已完成：tool metadata 的 `defaultTimeoutMs / recoveryStrategy / retryableErrorCodes` 现已被 skill/tool 执行链路统一消费；`command_exec`、`edit_replace` 与 skill runner 已收口默认 timeout、超时失败形态与 fail-closed retry 判定。
- `Week 6+` 的 `TOOL-25` Tool 返回值统一结构已完成：`command_exec` 与 `edit_replace` 现已统一暴露 `success / output / data / error / durationMs / metadata` 消费字段，上层不再需要按工具类型分支解析基础执行结果。
- `Week 6+` 的 `TOOL-26` 大输出外置化已完成：`command_exec` 超阈值输出现已把完整脱敏结果外置到 `ArtifactStore`，message 主链只保留截断摘要与 artifact 引用，并已完成回归验证。
- `Week 6+` 的第十三项 `TOOL-27` Skill 失败语义已完成：skill 已补齐 step 级事件、失败重试与 output 记录，并复用现有 execution / inspect / event 基础设施完成观测闭环。
- `Week 6+` 的第十四项 `TOOL-28` Skill 缓存正确性已完成：cacheable skill 现已把 git HEAD / source hash 纳入 cache key，命中时记录 cache provenance，并支持显式 disable 开关。
- `Week 6+` 的 `TOOL-29` Skill 组合权限闭环已完成：skill execution 现已在未显式传入 `allowedTools` 时回落到 execution `allowedToolsJson`，并对 model override 后的 `resolvedToolName` 再做运行时权限检查，skill 组合与模型感知工具切换都不能越过 execution 级工具权限。
- `Week 6+` 的 `TOOL-30` MCP 工具隔离验证已完成：MCP tool 现已强制 `mcp_<server>_<tool>` namespaced naming、阻断与 builtin tool 的碰撞命名，并要求显式 metadata 准入；MCP 返回内容会作为不可信外部内容单独 sanitize，伪造 `function_call / tool_use / tool_calls` 载荷会被 fail-close 阻断。
- `Week 6+` 的 `SEC-35` 当前 direct tool 权限与写路径范围切片已完成：execution `allowedToolsJson / allowedPathsJson` 与 request `allowedPathRoots` 现已被 `edit_replace` / `command_exec` 直接消费；direct tool 既不能越过 execution 级工具白名单，也必须对 malformed allowlist 配置默认 fail-closed，并同时满足 sandbox 与 path scope 两层路径约束。
- `Week 6+` 的第十五项 `P2-26` 消息 Parts 化已完成：`messages.parts_json` 已支持结构化持久化，`phase1b` tool result 现已按 `summary / artifact_ref / tool_result` parts 写入，且 Stage 1 context compaction 会优先裁掉 `tool_result` part 并保留摘要与 artifact 引用。
- `Week 6+` 的第十五项 `P2-27` 类型化事件总线已完成：event registry 已补齐 `payloadSchemaRef / compatibilityPolicy` 元数据，并新增 `TypedEventBus` 包装层把 skill execution 的事件发布收口到编译期可校验边界。
- `Week 6+` 的第十五项 `P2-28` 模型感知工具选择已完成：skill step 现已支持 `modelOverrides`，可按 `model profile / tier / capability` 把逻辑工具解析为实际工具变体，并把 requested/resolved tool 写入 step output 与 execution evidence；未知 profile 与未声明 override 目标默认 fail-closed。
- `Week 6+` 的 remote repo version consistency gate 已完成：worker heartbeat 现已上报 `repoVersion`，execution ticket 可声明 `requiredRepoVersion`，dispatch 对 repo mismatch 默认 fail-closed，并把拒绝理由链接入 trace / CLI / migration 兼容回放。
- `Week 6+` 的 `REMOTE-45` remote session telemetry / dispatch readiness 已完成当前可验收切片：worker heartbeat / snapshot 现已持久化 `remoteSessionStatus`、`lastAcknowledgedStreamOffset`、resume/credential/session consistency 遥测与关键远程 worker 指标；dispatch 现对非 `connected`、resume offset 缺失或 consistency mismatch 的 remote worker 默认拒绝新派发并写入 rejection trace，handshake / heartbeat / writeback 也已对 `viewer_only`、consistency mismatch 与 offset 缺失 fail-close，inspect CLI 新增 `workers` 查询，health / doctor 已补齐远程会话降级判定。
- `Week 6+` 的 `REMOTE-46` remote workspace sync conflict 语义已完成当前可验收切片：worker heartbeat / snapshot 现已持久化 `workspaceSyncStatus / workspaceSyncCheckedAt`；dispatch、handshake、writeback 与 `worker-handshake` / `worker-writeback` / `worker-register` CLI 对双端工作区冲突默认 fail-close 到 `remote_workspace_sync_conflict`，health 也已补齐远端工作区冲突降级判定。
- `Week 6+` 的 `SCHED-04` remote 降级策略收口已完成当前可验收切片：dispatch 现已对 `require_remote + partial_available` 显式 fail-close 到 `remote.partial_available`；inspect / diagnostics / inspect CLI 也已把 remote routing summary 扩展到 `healthy / partial_available / degraded / unavailable` 分桶计数。
- `Week 6+` 的 `OBS-51` 告警收敛已完成当前可验收切片：diagnostics `DebugDump` 现已提供按 task 聚合的 `warningSummary`，在保留兼容 `warnings[]` 去重输出的同时，补齐同类告警重复抑制计数、severity 分级与 escalation 路径定义。
- `Week 6+` 的 `OBS-52` 事故时间线生成器已完成当前可验收切片：diagnostics 现已新增 `incident` / `incident-export` 输出，可自动从 events、dispatch、step outputs、messages、structured logs 与 compaction 记录拼装 incident timeline report，提供候选 root cause、warning summary 与 source counts，并导出 `incident-timeline-<taskId>.json/.md` 双工件。
- `Week 6+` 的 `OBS-53` 观测数据保留策略已完成当前可验收切片：已新增 observability retention service，对 `tier_2 / tier_3` 事件按保留期清理、对 terminal session 的非摘要消息做受控清理，并保留 `tier_1` 审计事件、`summary / compaction_summary` 与 compaction 记录；doctor / diagnostics / stable evidence 已补齐 retention 摘要，structured logger 已改为固定容量环形缓冲。
- `Week 6+` 的 `REMOTE-47` 优雅维护下线演练已完成当前可验收切片：已新增 `stable-maintenance` rehearsal / CLI，输出 `stable-maintenance-report.json` 与 `stable-maintenance-playbook.json`，验证 draining worker 不接收新 dispatch、active lease 在 step 边界 handover、handover 后 stale write fail-close，并把 maintenance readiness 接入 `stable-evidence`、`stable-gate` 与 `stable-package`。
- `Week 6+` 的 `REMOTE-48` 分布式远程日志聚合已完成当前可验收切片：已新增 `remote_log_entries` 持久化与 worker handshake / writeback `AA_REMOTE_LOGS_JSON` 摄取，task timeline 已补齐 `remote_log` 条目，diagnostics CLI 新增 `remote-timeline` 只读视图，并把 remote warn/error logs 汇入 incident timeline source counts、上下文摘要与 root cause hints。
- `Week 6+` 的 `REMOTE-43` worker 调度健康态显式化已完成当前可验收切片：worker registry、dispatch trace、inspect workers、health/doctor 摘要现已统一暴露 `healthy / degraded / draining / quarantined / offline / unavailable` 调度健康态，运维面不再需要从 `idle / busy` 推断 worker 是否处于健康可调度区间。
- `Week 6+` 的 `REMOTE-42` 可信 remote worker registry 已完成当前可验收切片：已新增 challenge 式远程 worker 注册、capability allowlist、trusted registration 持久化字段与 `worker-register` CLI；dispatch / handshake / writeback 现已对未验证 remote worker 默认 fail-closed，远程执行所有权路径已从 heartbeat 自报收口到可信注册闭环。
- `Week 6+` 的 `QA-59` 上线门禁 checklist 已完成当前可验收切片：`stable-gate` 现已正式暴露 `requiredCriteria / optionalCriteria` 门禁结果，`stable-package` 现已生成结构化 `stable-release-checklist.json` 与摘要 markdown，把 smoke、long-run soak、recovery、rollback、runbook 与 ownership 收敛到正式 checklist 工件。
- `Week 6+` 的 `QA-60` 固定标准任务集已完成当前可验收切片：golden task 现已扩展到编程、研究、内容、数据、跨事业部、高风险审批与崩溃恢复 7 类固定 inventory，并由 `stable-runtime-validator` 落盘 `golden-task-inventory.json`。
- `Week 6+` 的 `QA-61` 回归基准线已完成当前可验收切片：`stable-runtime-validator` 现已在首跑写出 `stable-validation-baseline.json`，后续复跑输出 `baselineComparison`、`caseSummaries` 与 correctness regression / duration drift 对比，为版本退化量化提供正式工件。
- `Week 6+` 的 `QA-63` 回滚剧本已完成当前可验收切片：`stable-rollback` 现已在 `stable-rollback-report.json` 之外同步落盘 `stable-rollback-playbook.json`，把 `application_binary / config_bundle / feature_flag / worker_version / prompt_bundle` 的 rollback owner、prechecks、health validation、audit requirements 与 rehearsal evidence 收敛为正式 machine-readable playbook。
- `Week 6+` 的 `SEC-31` Prompt Injection 红队集已完成当前可验收切片：`stable-prompt-injection` 现已覆盖 instruction override、system prompt dump、remote shell pivot、credential harvest 与 benign control 5 类载荷，把 matched rules / injection risk / redaction / warning 收敛为正式 machine-readable 红队报告，并接入 `stable-evidence` 汇总判定。
- `Week 6+` 的 execution handover semantics 已完成当前可验收切片：execution lease service 现已支持受控 `handover`，可把 active lease 从旧 worker 转移到新 worker，显式记录旧 lease / 新 lease / lineage，递增 fencing token，并同步 execution owner 与 worker snapshot；stable lease rehearsal / CLI 已补齐 handover 场景。
- `24h / 72h` 长时稳定性证据继续按当前决策后置，后续实现主线保持在 `Week 6+` 的 remote / PG-Redis / enterprise prep。

### Phase 1a

- 建立 `src/`、`config/`、`divisions/`、`tests/` 目录骨架。
- 实现任务、工作流、审批、事件、成本守卫基础类型与枚举。
- 建立最小存储抽象与 SQLite schema 初版。
- 实现最小单 Agent happy path。
- 收紧状态机、错误模型、事件分级、幂等性和恢复检查。

### Phase 1b

- 引入 VP 运营和 VP 编排基础。
- 实现 HQ 侧有限任务拆分与聚合，保持在单事业部工作流与最小编排边界内。
- 接入 SSE / 流式输出。
- 增强上下文压缩与状态可视化。
- 保持在单事业部工作流与最小编排范围内，不提前做远程 worker / marketplace / 多租户。

当前 `Phase 1b` 工作包：

| 工作包 ID | 名称 | 对应批次 |
| --- | --- | --- |
| `P1B-01` | `intake_router` 确定性分诊运行时 | `Batch 1` |
| `P1B-02` | `workflow_planner` 与依赖图表达 | `Batch 1` |
| `P1B-03` | 单事业部内多 Agent orchestration runner | `Batch 1` |
| `P1B-04` | task board 与基础状态查询 | `Batch 1` |
| `P1B-05` | 两阶段 context compaction 与 pruning | `Batch 2` |
| `P1B-06` | edit fuzzy / context-anchored 增强 | `Batch 2` |
| `P1B-07` | VCR replay 与 stream chunk replay 增强 | `Batch 3` |
| `P1B-08` | debug dump / provider success rate / backpressure 增强 | `Batch 3` |

### Phase 2a

- 落地多个 division 样例。
- 增强 division loader、artifact 与恢复。
- 建立跨事业部验证测试。

当前 `Phase 2a` 工作包：

| 工作包 ID | 名称 | 对应批次 |
| --- | --- | --- |
| `P2A-01` | 多事业部 division loader 与声明式 workflow/role 加载链 | `Batch 1` |
| `P2A-02` | artifact store、step artifact lineage 与 recovery snapshot 基线 | `Batch 1` |
| `P2A-03` | inspect / timeline artifact 可见性与 minimal repro bundle export | `Batch 1` |
| `P2A-04` | runtime recovery repository、precheck 持久化与 division recovery overview | `Batch 1` |
| `P2A-05` | dead-letter repository 与 recovery decision audit | `Batch 1` |
| `P2A-06` | recovery replay report 与 CLI 回放链路 | `Batch 1` |
| `P2A-07` | cross-division recovery drill 报告与 CLI | `Batch 1` |
| `P2A-08` | execution ticket repository、dispatch service 与 stable dispatch rehearsal | `Batch 1` |
| `P2A-09` | worker claim / heartbeat handshake 与 stable worker rehearsal | `Batch 1` |
| `P2A-10` | worker authoritative writeback / completion handshake 与 stable rehearsal | `Batch 1` |

### Phase 2b

- 按 ROI 落地记忆层。
- 强化多渠道、监管、稳定性与观测。
- 建立长时运行评审。
- 当前已完成 `MEM-05` memory repository / recall / quality baseline、`MEM-01` token estimation precision 与 `MEM-02` STM -> LTM consolidation 三个首批代码切片。

### Phase 2c

- 建立 skill 系统。
- 引入 HR Agent 边界化能力。
- 实现 evolution MVP 与审批链。

### Phase 3

- 启动 PMF 指标验证。
- 落地收费能力与感知模块 MVP。
- 补强 Web / API 产品体验。

### Phase 4

- 推进 enterprise 能力矩阵。
- 引入 marketplace / 生态治理。
- 建立 SLA、组织治理和规模化运维体系。

## 说明

- 当前 `Week 5` 稳定化收口已补齐 release gate checklist、prompt injection 红队集、rollback playbook、disaster recovery playbook、rolling upgrade playbook 与 tenant-gray rollout playbook；但 `24h / 72h` 长时证据仍是阶段关闭前的待完成项。
- 当前 revision 已完成 `Phase 1a`、`Phase 1b`、`Phase 2a`、`Phase 2b` 与 `Phase 2c` 的开发工作包，并按当前决策进入 `Phase 3`；`Phase 1a` 的 `24h / 72h` 长时证据仍作为待关闭项保留。
- 后续阶段文档已准备完毕，但仍应遵守阶段范围，不得借 `Phase 2a` 抢跑长期 remote platform / marketplace / tenant 平台层。
- 改善项优先级以 `operations-roadmap.md`、`current_status_and_gap_analysis.md` 和专项 review 为准。
- 实际项目状态以 `project_progress_tracker.md` 为准。
