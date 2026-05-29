# Current Todo List

> 本文件当前以 v4.3 Executable Specification Freeze 为主索references。下方“2026-04-25 full测试failed清单”保留为历史测试基线，used for回归对账；它不再作为 v4.3 新路线的唯一优先级来源。
> 2026-05-14 复核：`docs_zh/reviews/issues-table.md` is本轮 design review Issue收口的权威逐linesStatustable；本文件只保留长期运lines批iterations和历史回归基线，不再作为 review issue 的唯一完成判定来源。

## v4.3 Executable Specification Freeze 当前待办

### A9 剩余测试failed簇最终收口（2026-04-28）

> 本批iterations承接 A8 之后仍未关闭的测试failed，目标is一iterations性收口当前已识别的剩余failed簇；优先修复真实实现vs契约/export面漂移，再对齐明确已稳定语义的测试断言，最后重跑定向回归vs更广基线。

- [x] 修复 orchestration 剩余failed：`TopologyValidator` defaults to构造、progressive demotion、loop controller、assessment service、feedback signal schema、execute bridge 兼容export。
- [x] 修复 runtime / stability / compliance / pack 剩余failed：output continuation、stable release package、compliance program、pack lifecycle。
- [x] 修复 `redis-queue-adapter` failed簇，确认connect生命cycle、synchronous接口vs测试桩一致。
- [x] 运lines本批iterations定向测试vs更广回归，回写收口证据并synchronous todo Status。

> A9 收口证据（2026-04-28）：
> - 已修复真实实现Issue：`StructuredLogger.recent()` 返回最近窗口顺序、`ModelRoutingService` trace variable初始化时序、`DomainDefinitionSchema` defaults to `capabilities`、`KvCachePrefix` defaults toconstantexport、`RecoveryOrchestratorService` cycle耗时/容错、baseline constant深冻结。
> - 已对齐稳定语义测试：task/workflow terminal step index 保持最终步、task timeline golden 双测试统一 `entryKinds`、`routeComplexity` 关键词vs passthrough 优先级、dispatcher `require_remote` fail-close 为 `blocked`、plugin cooldown lines为、DLQ `setReason` 更新time、baseline Description相关性断言等。
> - 已via的定向回归覆盖：`tests/unit/platform/five-plane-orchestration/harness/loop-controller.test.ts`、`tests/unit/platform/five-plane-execution/execution-engine/complexity-router.test.ts`、`tests/unit/platform/five-plane-execution/execution-business-logic.test.ts`、`tests/unit/domains/registry/domain-model-validation.test.ts`、`tests/unit/domains/registry/plugin-spi-registry-invocation.test.ts`、`tests/unit/platform/five-plane-execution/dispatcher/*.test.ts`、`tests/unit/platform/five-plane-control-plane/control-plane-baseline-extended.test.ts`、`tests/unit/platform/model-gateway/model-gateway-baseline-extended.test.ts`、`tests/integration/interaction/autonomy/autonomy-integration.test.ts`、`tests/integration/platform/shared/outbox/durable-event-bus-integration.test.ts`、`tests/integration/platform/shared/observability/structured-logging-integration.test.ts`、`tests/integration/platform/five-plane-execution/execution-engine.test.ts`、`tests/integration/platform/five-plane-state-evidence/events/dlq-integration.test.ts`、`tests/golden/task-timeline-output.test.ts`、`tests/golden/task-timeline-service.test.ts`、`tests/e2e/task-terminal-state-flow.test.ts` 等批iterations。

### A8 剩余测试failed簇继续收口（2026-04-28）

> 本批iterations承接 A7 之后的剩余failed簇，目标is继续压降当前full测试中的真实code缺陷vs明显陈旧断言；先修复运lines时/接口层真实语义Issue，再对齐已稳定 contract 的测试预期，最后回跑定向测试形成新的收口证据。

- [x] 修复真实codeIssue：DataLineageService 返回值隔离、Postgres DSN `SSLMODE` 大小写兼容、零额度 in-memory rate limit、TaskWebSocketStatusRelay 事件顺序、Lease repository/mock 漂移等。
- [x] 对齐已稳定 contract 的陈旧测试断言：currency rounding、unicode 排序、delegation request 空值归一化、API schema/error helper、request body 空字符串、package export surface、skill serializer 等。
- [x] 修复 state machine / scheduler / hot-upgrade / documentation link 等剩余failed簇，确保文档vs实现一致。
- [x] 运lines当前批iterations涉及的定向单测，recordvia结果vs仍待handle的剩余项。

> A8 收口证据（2026-04-28，补充）：
> - 已修复并复测via的真实语义Issue继续覆盖：`TaskWebSocketStatusRelay` 逆time广播顺序、`ModelRoutingService` cost-cap fallback、`PluginSpiRegistry` cooldown gate、`ApiKeyService` 过期 key rotate fail-close、cross-division replay report 细节兼容输出。
> - 已对齐并复测via的陈旧断言继续覆盖：failure miner 非 failure 信号过滤、plugin runtime protocol input 结构、sandbox root 路径规范、stability rehearsal 单场景报告断言、dashboard event type/entity 提取、domain helper / vertical architecture import路径等。
> - 本轮新增定向复测已via：`tests/integration/platform/five-plane-interface/api/task-websocket-status-relay-integration.test.ts`、`tests/integration/platform/five-plane-orchestration/learn/failure-pattern-miner-integration.test.ts`、`tests/integration/platform/security/sandbox-command-executor.test.ts`、`tests/integration/platform/shared/stability/cross-service-stability-integration.test.ts`、`tests/integration/platform/stability/stable-cross-division-recovery-drill-integration.test.ts`、`tests/integration/platform/model-gateway/model-routing-integration.test.ts`，以及对应 domain / plugin / dashboard / governance / api-key 单测批iterations。

### A7 full测试收口批iterations（2026-04-28）

> 本批iterations目标is在不回退既有Architecturevs契约修复的前提下，持续收敛当前full测试剩余failed；优先handle高频failed簇、缺失兼容入口、barrel export漂移，以及 build/typecheck/test 三者之间的inconsistent。

- [x] 补齐最近发现的缺失兼容源文件vs legacy import shim，消除 skipped/missing source 报告。
- [x] 执lines source-only typecheck，修复因兼容层、barrel、精确optionalclass型或Status语义漂移references入的新错误。
- [x] 按failed簇收口 Harness / Learn / CLI / Dispatcher / HITL / Runtime 输出续写等高频测试Issue。
- [x] 重新运lines定向测试vsfull测试，更新最新failed基线并继续压降，直到当前批iterations可收口。
- [x] 完成后回写本 todo Status，并保留历史failed基线作为对比证据。

> A7 收口证据（2026-04-28）：
> - 已补齐 skipped/missing source 报告涉及的兼容入口：`event-indexer.ts`、`learning-feedback-service.ts`、`authoritative-truth-store.ts`、`task-queue.ts`、`dispatcher.ts`、`cache-manager.ts`、`session-service.ts`、`trust-store.ts`、`distributed-lock-manager.ts`。
> - source-only typecheck 已via：`npx tsc -p tsconfig.build.json --noEmit`（回执：`/tmp/oap-source-typecheck-20260428.log`，退出码 `0`）。
> - 本轮定向修复并复测via：HA repository / HA barrel / HA coordinator / HITL inbox / HITL escalation / HITL approval orchestration / HITL integration / 相关先前failed簇。
> - 最近一iterations完整full基线：`/tmp/automatic-agent-platform-npm-test-20260428f.log`，结果为 `49632 tests / 49477 pass / 149 fail / 6 skipped`；本轮新增修复completed定向复测，待后续full基线继续吸收剩余非本批iterations测试漂移。

### A6 Implementation Consistency Audit full收口批iterations（2026-04-27）

> 本批iterations以 `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md` 中 C/T/A/G/O/S/M/F/I/D 全部#为输入，目标is把旧差异table改为可验证的收口报告，并为 238 个审计#建立机器可检查的 coverage registry。

- [x] 建立 `ImplementationConsistencyClosureRegistry`，覆盖 C-1..C-7、T-1..T-56、A-1..A-37、G-1..G-9、O-1..O-24、S-1..S-20、M-1..M-20、F-1..F-25、I-1..I-20、D-1..D-20。
- [x] 增加 invariant 测试，验证审计#total、各分组count、关闭Status、收口class型和证据路径。
- [x] 将 `platform-architecture-implementation-consistency-audit.md` 从开放差异清单改写为full已收口验收报告。
- [x] 执lines聚焦测试、source-only typecheck vs diff whitespace check。

### A5 Design Review 新增约束实现收口批iterations（2026-04-27）

> 本批iterations以 `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md` §6 中仍为“部分完成 / 未实现”的条目为输入，目标is为每个新增Architecture约束补齐可执lines实现入口、聚焦测试和审计证据；生产演练class条目以可执lines gate / receipt / report 对象收口，不伪装为线上 GA 证据。

- [x] P0 多租户vs入口security：补齐 WebSocket/SSE tenant scope 逐事件过滤、SDK version handshake、endpoint-class backpressure vs worker service identity 检查。
- [x] P0 运lines时终态清理：补齐 WorkerDrainProtocol receipt、RunTerminationCleanup、plugin crash cleanup hook、orphaned budget reservation metric vs DB time / clock-skew safe budget sweeper。
- [x] P0 兼容vs漂移：补齐 ConfigDriftReconciler、PackCompatibilityTestGenerator、ResumeCompatibilityCheck / ResumeDiffReport。
- [x] P1 调度vs恢复：补齐 dispatch queue bounded event 字段、Graph Scheduler queue depth evidence、DR drill pass/fail vs tombstone replay boundary、no-real-side-effect replay guard。
- [x] P1 协作vs审批：补齐 delegation sequencing/idempotency、approval delegation chain TTL upper limit、high precision timer、guardrail vibration breaker。
- [x] P2 治理vs企业能力：补齐 OrgGovernanceSaga、SCIM DLQ retry/reconciliation、Chinese Wall grant/release 2PC、GovernanceDelegationRevocationSaga。
- [x] P3 运营成熟度：补齐 cache warming degradation gate、judge-unavailable canary gate、memory self-reinforcement guard、feedback collective anomaly detector、Improvement rollback_pending、ComplianceReport HumanSignoff timeout、Capacity forecast-vs-actual recalibration、promotion rollback/emergency hotfix evidence。
- [x] 增加聚焦单测，覆盖上述新增实现入口和关键不variable。
- [x] 更新 `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md` §6 vs本 todo Status。
- [x] 执lines定向测试、source-only typecheck vs diff whitespace check。

### A4 Design Review 后Architecture实现逐条复核（2026-04-27）

> 本轮以最新 `docs_zh/architecture/00-platform-architecture.md` 为权威输入，重点复核刚吸收的 `architecture-design-review` 约束isno已有code、测试、contract 或运营证据；旧审计完成态只能作为历史基线，不能自动视为本轮新增约束completed。

- [x] 提取最新Architecture文档中新增/强化的可执lines约束，尤其is §2.5、§7-§12、§14、§15、§17-§24、§31-§32、§45、§46-§51、§56、§66-§67。
- [x] 对照 `src/`、`tests/`、`docs_zh/contracts/`、`docs_zh/adr/`、`config/`、`divisions/` 逐项核查实现完成度。
- [x] 将每项标记为：completed、部分完成、未实现、文档规划/后续生产证据、文档/实现inconsistent。
- [x] 更新 `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md`，追加本轮新增约束的事实矩阵、差距清单和优先级。
- [x] 回写本 todo 的执linesStatus，并运lines文档 diff 检查。

## 00-platform-architecture.md 实现一致性审计当前待办

> 本轮审计以 `docs_zh/architecture/00-platform-architecture.md` 为权威输入，逐条核对实现isno完成、isnovs文档Description一致；先产出事实矩阵vs差距清单，再决定后续实现批iterations。

### I2 审计缺口实现收口批iterations

- [x] 修正 §35 Harness Runtime 权威路径，使Architecture文档、结构测试和当前code目录一致。
- [x] 新增 `ArchitectureInvariantRegistry` vs `NonOverridableInvariantRegistry`，并用 `tests/invariants/` 覆盖 §2.4/§36 的机器可验证不variable。
- [x] 将 architecture readiness ring Status从单一 `complete` 改为分层 gate evidence，避免把 readiness 登记误判为生产full完成。
- [x] 建立 `docs_zh/domains/<domain>/domain-spec.md` 落点，覆盖 §71-§94 的 24 个垂直域规范入口。
- [x] 增加 API canonical vs legacy guard 测试，证明 legacy contract 目录不is v4.3 canonical runtime 入口。
- [x] 更新本审计报告，把已收口项改为完成并record验证命令。
- [x] 执lines typecheck、定向测试vs diff 检查。

### A3 00-platform-architecture.md 全文逐条一致性复核

- [x] 提取 `00-platform-architecture.md` 的full一级/二级章节，明确本轮逐条核对粒度为 §1-§94、三环路线、推荐code目录、附录vs关键子章节。
- [x] 按章节建立实现一致性矩阵，逐项标记为：完成、部分完成、未实现、文档规划/不适用、vs实现inconsistent。
- [x] 将每个Conclusion绑定到证据路径：`src/`、`tests/`、`docs_zh/contracts/`、`docs_zh/adr/`、`config/`、`divisions/` 或明确缺口。
- [x] 核对Architecture文档中的Five-Plane、OAPEFLIR/HarnessRuntime、State & Evidence、Event、Storage、Runtime MVP vs三环 readiness isnovs当前实现一致。
- [x] 核对上层能力：AI 运营、业务域、智能交互、组织治理、规模生态、运营成熟度、24 垂直域isno为真实完成、部分骨架或only规划登记。
- [x] 更新实现一致性审计报告，避免把 readiness/evidence 登记误写成完整生产实现。
- [x] 执lines文档 diff 检查vs必要的只读/定向验证命令。

### I1 审计收口完成批iterations

- [x] 补齐 intake/admission 主链：RawInput -> TaskDraft -> ConfirmedTaskSpec -> RequestEnvelope -> HarnessRun，并在 admission 时冻结 RunVersionLock。
- [x] 补齐 PlanGraph normalize / validate / risk propagation / worst-path analysis，并让 scheduler 输出 platform fact decision event。
- [x] 补齐 RuntimeStateMachine 权威边界：RunVersionLock、policy guard、budget precondition、side-effect safety、audit append vs NodeRun lease/fencing mandatory校验。
- [x] 补齐 runtime repository contract：Repository interface、append-only receipt、runtime truth transaction、outbox/audit 事件边界vs v4.3 physical schema baseline。
- [x] 补齐 Event Registry metadata/replayBehavior/consumer contract tests，并接入 v4.3 EventEnvelope Description符。
- [x] 补齐 BudgetAllocator、SideEffect commit 前复检、HITL responsibility 链路和 HarnessRuntime executor/evaluator/decision 基础闭环。
- [x] 增加 bypass invariant tests，证明 legacy ExecutionPlan/workflow/step 不能作为 v4.3 runtime 入口或directly写 truth。
- [x] 更新 `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md`，将已实现项改为完成，并将 ADR-112 三环登记为 complete readiness。
- [x] 执lines source-only build、定向 runtime/contracts/storage/event 测试vs diff 检查。

### I0 审计后实现批iterations 1

- [x] 为 `src/platform/contracts/executable-contracts/` 增加 executable contract package，覆盖 28 个 v4.3 canonical contract 的 Zod schema、JSON Schema 摘要、replay behavior、failure behavior vs校验入口。
- [x] 将 GraphPatch operation enum 对齐 `00-platform-architecture.md`：`add_node` / `add_edge` / `disable_edge` / `add_compensation_node` / `add_failure_path` / `mark_skipped` / `append_subgraph`。
- [x] 为 `NodeRun` 补齐 `blocked` Statusvs `blocked -> ready/skipped/cancelled/dependency_failed/policy_blocked/aborted` Status推进。
- [x] 更新中文 contract vs v4.3 定向测试，验证 executable contract package、GraphPatch safety、NodeRun blocked gating。

### A0 审计计划

- [x] 提取 `00-platform-architecture.md` 的可检查Architecture承诺，按 Contract Freeze、Five-Plane、Runtime/OAPEFLIR、State & Evidence、治理vs扩展层分组。
- [x] 建立实现核对口径：完成、部分完成、文档/实现inconsistent、未实现、exceeds出 v4.3 MVP 范围。
- [x] 保留 v4.3 completed实现vs历史测试基线边界，避免把既有no关failed归因到本轮审计。

### A1 逐项核对

- [x] 核对 v4.3 Contract Freeze 12 个核心契约vs `docs_zh/contracts/`、`src/platform/contracts/executable-contracts/`、单测isno一致。
- [x] 核对 RuntimeStateMachine、Graph Scheduler、NodeRun、NodeAttemptReceipt、SideEffect、Budget、HITL、Event 分层isno符合Architecture主链。
- [x] 核对Five-Planevs推荐目录在 `src/platform/`、`src/domains/`、`src/interaction/`、`src/org-governance/`、`src/scale-ecosystem/`、`src/ops-maturity/` 的实现覆盖。
- [x] 核对 State & Evidence、Event Registry、Projection、DLQ/Incident、Repository/Storage vsArchitecture文档的一致性。
- [x] 核对 AI 运营层、业务域接入层、智能交互层、组织治理层、规模生态层、运营成熟度层的实现Statusvs范围边界。

### A2 审计输出

- [x] 生成中文实现一致性审计报告，record逐项Status、证据路径、主要偏差vsRecommendation优先级：`docs_zh/reviews/platform-architecture-implementation-consistency-audit.md`。
- [x] 更新本 todo 的审计项Status。
- [x] 执lines文档 diff 检查vs必要的定向验证命令。

### P0 文档冻结

- [x] 新增 ADR-109 至 ADR-112，冻结 v4.3 契约范围、Status机权威、事件分层vs MVP 三环边界。
- [x] 更新 `docs_zh/adr/README.md`，将 ADR-109 至 ADR-112 标为 v4.3 实现入口。
- [x] 更新 `docs_zh/contracts/README.md`，新增 `v4.3 Contract Freeze Scope` 分组。
- [x] 新增 v4.3 中文 contract 文档，覆盖 `00-platform-architecture.md` 已冻结的 12 个核心契约。
- [x] 明确旧 `ExecutionPlan` / `ExecutionReceipt` / `ControlDirective` / `StateCommand` / `workflow_run` / `step` 只能出现在 legacy、deprecated、projection 或历史语境，不再作为新实现入口。

### P1 契约实现

- [x] 在 `src/platform/contracts/` 建立 v4.3 canonical class型、schema vs factory。
- [x] 建立 contract naming consistency test，阻止旧名重新进入 canonical class型export。
- [x] 将 `TaskDraft` / `ConfirmedTaskSpec` / `RequestEnvelope` 接入 intake contract。
- [x] 将 `PlanGraphBundle` / `GraphPatch` / `NodeRun` / `NodeAttemptReceipt` 接入 runtime contract。
- [x] 将 `BudgetLedger` / `SideEffectRecord` / `RunVersionLock` / `DecisionInputBundle` / `HumanResponsibilityRecord` 接入治理 contract。

### P2 Runtime MVP

- [x] 实现 `RuntimeStateMachine.transition(command)`，作为 `HarnessRun` / `NodeRun` / `SideEffect` / `Budget` Status推进唯一入口。
- [x] 实现 `EventInbox` / `PlatformFactEvent` / `OapeflirViewEvent` 分层，确保 truth projector 只消费 `platform.*`。
- [x] 接入 HarnessRuntime MVP 主链：`PlanGraphBundle -> Graph Scheduler -> NodeRun -> NodeAttemptReceipt -> Event/Audit/Evidence`。
- [x] 接入 GraphPatch security校验，禁止静默改写已执lines节点、已提交副作用或已record receipt。
- [x] 接入 SideEffect reconciliation / compensation 最小闭环。
- [x] 接入 v4.3 runtime repository，验证 truth mutation vs `platform.*` fact event append 的原子边界。

### P3 测试门禁

- [x] 新增 runtime state-machine transition tests。
- [x] 新增 event consumer test：truth consumer 不消费 `oapeflir.view.*`。
- [x] 新增 GraphPatch safety test。
- [x] 新增 budget hard-cap concurrency test。
- [x] 新增 HITL responsibility record test。
- [x] 新增 runtime repository atomic transition/event append test。
- [x] 执lines v4.3 范围的 source-only build validation vs runtime/contracts/storage/event 定向测试。完整 `npm run typecheck`、`npm run test:unit` vs广域 integration sweep 仍由下方历史基线manage，因为它们仍contains既有no关failed。

### P4 后续扩展

- [x] Hardening Ring：已record replay、recovery、lease/fencing、DLQ、diagnostics vs evidence bundle 为 v4.3 MVP 之后的下一环范围。
- [x] Enterprise Ring：已record组织治理、SSO/SCIM、多租户隔离、跨区域、Marketplace、Edge vs PlatformOps 为三环Architecture下的后续范围。
- [x] 24 域vs DomainRecipe 已确认为不阻塞 v4.3 Contract Freeze MVP；only在核心 runtime 语义稳定后进入批量接入。

## 历史测试基线：full测试failed清单（2026-04-25）

> 以下清单保留为 2026-04-25 的历史failed基线，used for后续对比 v4.3 修复isno扩大或缩小回归面；不删除、不重排。

## 9. full测试failed清单（2026-04-25 更新）


### 测试结果汇总

| 测试套件 | via | failed | Status |
|---------|------|------|------|
| Build | - | 0 | ✓ |
| Unit | 30,963 | 354 | 历史基线已归档 |
| Integration | - | - | 历史未运lines已归档 |
| **总计** | **30,963** | **354** | |

### Unit failed（354个）

**整体测试**: 31,317 tests / 30,963 pass / 354 fail / 0 cancelled

---

## 按目录分class的测试failed

### 1. unit/platform/five-plane-state-evidence/truth (84个failed)
- SQLite repositories 相关测试

### 2. unit/platform/shared/observability (55个failed)
- observability 相关测试

### 3. unit/platform/five-plane-interface/api (52个failed)
- API 接口相关测试

### 4. unit/platform/five-plane-orchestration/oapeflir (50个failed)
- oapeflir 相关测试

### 5. unit/platform/shared/stability (43个failed)
- stability 相关测试

### 6. unit/platform/shared/cache (35个failed)
- cache 相关测试

### 7. unit/platform/five-plane-state-evidence/knowledge (33个failed)
- knowledge 相关测试

### 8. unit/platform/five-plane-state-evidence/events (30个failed)
- events 相关测试

### 9. unit/platform/five-plane-orchestration/harness (30个failed)
- harness 相关测试

### 10. unit/platform/five-plane-state-evidence/memory (24个failed)
- memory 相关测试

### 11. unit/platform/five-plane-execution/worker-pool (22个failed)
- worker-pool 相关测试

### 12. unit/platform/five-plane-interface/channel-gateway (16个failed)
- channel-gateway 相关测试

### 13. unit/platform/model-gateway/provider-registry (15个failed)
- provider-registry 相关测试

### 14. unit/platform/five-plane-orchestration/agent-delegation (14个failed)
- agent-delegation 相关测试

### 15. unit/platform/five-plane-state-evidence/artifacts (13个failed)
- artifacts 相关测试

### 16. 其他目录（约50个failed）
- prompt-engine/eval: 10个
- orchestration/hitl: 9个
- interface/ingress: 9个
- orchestration/planner: 8个
- orchestration/learn: 7个
- state-evidence/checkpoints: 6个
- shared/scaling: 6个
- shared/outbox: 6个
- interaction/autonomy: 5个
- scale-ecosystem/integration/connectors: 4个
- feedback-loop/collector: 4个
- orchestration/routing: 4个
- interface/webhook: 4个
- interface/scheduler: 4个
- 其他零散failed

---

## 详细测试failed列table（354个）

### eval-framework (2个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 815 | LlmEvalService.runCiGate reports regressions | runCiGate 回归检测 |
| 817 | LlmEvalService.runCiGate respects passingVerdicts option | passingVerdicts 选项 |

### execution-outcome-evaluator (1个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 841 | ExecutionOutcomeEvaluator.evaluate suggests approve for low quality score | 低质量分数Recommendation审批 |

### DomainGovernancePolicySchema (3个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 1041 | DomainGovernancePolicySchema rejects duplicate roles across arrays | repeats角色 |
| 1042 | DomainGovernancePolicySchema accepts empty restrictedDataClasses | 空 restrictedDataClasses |
| 1043 | DomainGovernancePolicySchema accepts empty mandatoryEvidence | 空 mandatoryEvidence |

### HrRoleGovernanceService (2个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 1089 | HrRoleGovernanceService submitProposal returns null approvalRequest when validation fails | 验证failed时返回 null |
| 1093 | HrRoleGovernanceService registerApprovedRole throws when proposal invalid | no效提案 |

### state-transition (1个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 1125 | activate changes status to active and records timestamp | Status激活 |

### detectAmbiguity (5个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 2331 | detectAmbiguity returns false for high confidence regardless of entities | 高置信度 |
| 15076 | detectAmbiguity treats confidence of 0.7 and above as not low | 0.7及以上 |
| 15078 | detectAmbiguity with exact entity count matches required | 精确实体计数 |

### AgentVersionManager (2个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 2868 | AgentVersionManager.switchSlot returns null when no current version | switchSlot 返回 null |
| 2934 | AgentVersionManager: blue-green deployment ping-pong | 蓝绿部署 |

### buildForensicSnapshot (4个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 3735 | buildForensicSnapshot returns distinct copies | 返回不同副本 |
| 1 | filters by stepId | 按 stepId 过滤 |
| 2 | filters by eventType | 按 eventType 过滤 |
| 4 | combines multiple filters | 组合过滤 |
| 8 | filterEvents | 过滤事件 |

### ExecutionTracer (3个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 4540 | ExecutionTracer | 执lines追踪器 |
| 1 | creates step with running status | 创建运lines中步骤 |
| 2 | overwrites existing step state when called again | 覆盖现有Status |
| 5 | failStep | failed步骤 |

### StepInspector (1个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 4564 | StepInspector | 步骤检查器 |

### PlatformApplicationKernel (2个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 5874 | buildStartupPlan includes domains startup plan when required | contains domains 启动计划 |
| 5876 | buildStartupPlan includes interactionGovernance plans when interaction layer required | contains interactionGovernance 计划 |

### coverage-baseline-guard (1个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 446 | coverage-baseline-guard | 覆盖率基线守卫 |

### PromptVersionManager (4个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 6337 | compareVersions returns -1 when v1 < v2 | v1 < v2 |
| 6339 | compareVersions returns 1 when v1 > v2 | v1 > v2 |
| 6341 | compareVersions treats version without patch as less than with patch | no patch 版本 |
| 6367 | compareVersions handles large version differences | 大版本差异 |

### CostReportService (1个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 10061 | CostReportService creates cost reports with resource breakdown | 成本报告 |

### dispatchNext (约20个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 10198-10219 | dispatchNext 相关测试 | Worker 调度选择 |

### IntakeRouter (2个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 10496 | handles follow-up with orchestration for retry scenario | 重试场景 |
| 10518 | matchedRules contains keywords that triggered intent | 匹配规则 |

### OrphanCleanupService (4个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 11316 | enforce applies close_orphan_session for orphan sessions | 孤儿会话 |
| 11317 | marks applied false when session already terminal | 会话已终结 |
| 11319 | applies clean_worker_execution_refs for worker orphans | 清理 worker references用 |
| 11325 | cleans multiple orphan refs in single worker | 清理多个孤儿references用 |

### parseStepOutput (2个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 11457 | handles single line content | 单lines内容 |
| 11567 | handles single word content | 单字内容 |

### FailoverController (3个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 11756 | initiateFailover rejects non-idle state | 非空闲Status |
| 11779 | onFail callback is called on error | 错误回调 |
| 11783 | concurrent initiation attempts are rejected | concurrent尝试 |

### LeaderElectionService (约12个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 11893-11930 | LeaderElectionService 系列测试 | HA 领导者选举 |

### Postgres/Redis Lock Adapter (约25个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 12338-12425 | PgAdvisoryLockAdapter / RedisLockAdapter 系列测试 | 锁适配器 |

### retryJob (1个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 12823 | returns null for non-dead-letter job | 非死信任务 |

### execution-plane-bootstrap (1个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 13562 | bootstrap is immutable | bootstrap 不可变 |

### sandbox (3个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 14119 | read-only workspace mode blocks write operations | 只读工作区 |
| 14120 | command execution populates data.injectionRisk | 注入风险 |
| 14121 | command failure with non-zero exit code returns failed status | 命令failed |

### ToolExecutor (1个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 14315 | executeParallel reports failures in errors array | 并lines执linesfailed |

### WorkerRegistryService (3个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 14833 | issueChallenge normalizes and deduplicates capabilities | 能力规范化 |
| 14876 | listEligibleWorkers strict does not meet hardened requirement | 严格要求 |

### assessPromotion/calculateTrustScore (约15个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 15019-15068 | assessPromotion / calculateTrustScore / scoreSystemHealth 系列 | 信任评分和晋升 |

### detectAmbiguity (2个failed)
| # | 测试名称 | 错误Description |
|---|---------|---------|
| 15076 | treats confidence of 0.7 and above as not low | 0.7 及以上 |
| 15078 | with exact entity count matches required | 精确计数 |

### 其他零散failed

| # | 测试名称 | 错误Description |
|---|---------|---------|
| 15094 | resolveTriggerActionMode handles undefined risk level | 未defines风险等级 |
| 15474 | normalizeError returns original AppError unchanged | 错误规范化 |
| 16419 | ChannelGatewayService resolves target by targetId directly | 目标解析 |
| 16877 | ingress module with mocks | 入口模块 |
| 17101 | LongRunningWorkflowService.sweepExpired with remain_pending | 过期工作流 |
| 17120-17149 | DequeueResult / nack 系列测试 | 队列操作 |
| 17206-17214 | WebhookIngressService 系列测试 | Webhook 入口 |
| 17356-17464 | BudgetGuard / estimateMessageTokens 系列 | budget和令牌计算 |
| 17715-18062 | model routing / UnifiedChatProvider / SloAlertingService 系列 | 模型路由和 SLO |
| 18091 | StructuredLogger configureGlobalFileSink accepts file path string | 结构化日志 |
| 18167-18211 | BenchmarkRunner / ProposalEngine 系列 | 基准和提案 |
| 19166-19317 | ExperienceDistillationService / FailurePatternMiner / StrategyLearningService 系列 | 学习服务 |
| 19866-19881 | PlanSchema / PlanStepSchema 系列 | 计划模式 |
| 20612-20622 | ConnectorManifestSchema 系列 | connect器清单 |
| 21569-21579 | ServiceRegistry 系列 | 服务注册table |
| 22686-23228 | FairScheduler / HorizontalScalingController / EnvironmentReadinessOrchestrationService 系列 | 调度和扩展 |
| 23257-23276 | classifyPromptInjectionRisk / protectSystemPrompt 系列 | security分class |
| 23287-23468 | StableAcceptanceLineReport / StableChaosSmoke / StableConcurrencyRehearsal 系列 | 稳定性测试 |
| 23767 | CheckpointManager | 检查点manage |
| 23926-23933 | durable event bus 系列 | 持久事件总线 |
| 24000 | EventReliabilityInventoryService | 事件可靠性清单 |
| 26133-26134 | isSqliteWriteContentionError | SQLite 写争用 |
| 26183 | ExecutionRepository updateExecutionStatus | 执lines仓储 |
| 26611-26632 | SessionDualStorageService 系列 | 会话双storage |
| 26776 | AuthoritativeTaskStore with mocked database | 任务storage |
| 26958-26986 | domainDefinition 系列 | 领域defines |
| 27116-27170 | platform root / LoopDetectionState / buildContinuationPrompt 系列 | 平台根和循环检测 |
| 27766-27776 | routeComplexity / LoopDetectionState 系列 | 路由复杂度和循环检测 |
| 27805 | parseOptionalStringArray | optional字符串数组解析 |
| 27888 | BillingServiceAsync throws for non-existent account | 计费服务 |
| 28013-28026 | assertIdentifier / monthWindow 系列 | 断言和窗口 |
| 28467-28516 | PerceptionService / PmfValidationService 系列 | 感知和 PMF 验证 |
| 29186-29235 | OpsHealthMonitorService / PlatformOperatorService 系列 | 运营健康监控 |
| 29339-29404 | isQuotaExceeded / TenantPlatformService / scale-ops 系列 | 配额和租户平台 |
| 29765-29769 | loadModelRoutingCliEnv 系列 | 模型路由 CLI |
| 29927 | create action does not require snapshotId | 创建操作 |
| 30383 | createTempWorkspace creates a temporary directory with correct prefix | 临时工作区 |

---

## Root Cause分析

1. **测试断言vs实现不匹配** - 多个测试的预期值vs实际实现inconsistent
2. **Mock 对象不完整** - mock data库/服务未正确模拟实际lines为
3. **concurrent测试Issue** - 测试concurrent执lines时的竞态条件
4. **环境/configureIssue** - 测试需要特定环境configure但未提供



### Recommendation

1. **对于测试断言错误**：需要检查测试文件中的断言isnovs最新实现匹配
2. **对于 mock Issue**：需要更新 mock 对象以正确模拟实际服务lines为
3. **对于concurrentIssue**：考虑降低测试concurrent度或添加适当的synchronous机制

---

## 历史基线归档清单

> 以下 #15-#30 已不再作为当前活动待办manage；它们is 2026-04-25 历史测试基线的索references。当前Architecture实现收口已由 A5/A6 的 registry、gate、receipt、report vs invariant 测试承接。

| 任务ID | 目录 | failed数 | Status |
|-------|------|--------|------|
| #15 | unit/platform/shared/observability | 55 | 已归档 |
| #16 | unit/platform/five-plane-state-evidence/memory | 24 | 已归档 |
| #17 | unit/platform/five-plane-interface/channel-gateway | 16 | 已归档 |
| #18 | unit/platform/five-plane-execution/worker-pool | 22 | 已归档 |
| #19 | unit/platform/model-gateway/provider-registry | 15 | 已归档 |
| #20 | unit/platform/five-plane-state-evidence/knowledge | 33 | 已归档 |
| #21 | unit/platform/five-plane-state-evidence/artifacts | 13 | 已归档 |
| #22 | unit/platform/five-plane-orchestration/agent-delegation | 14 | 已归档 |
| #23 | 其他目录 | ~50 | 已归档 |
| #24 | unit/platform/five-plane-state-evidence/events | 30 | 已归档 |
| #25 | unit/platform/five-plane-orchestration/harness | 30 | 已归档 |
| #26 | unit/platform/shared/stability | 43 | 已归档 |
| #27 | unit/platform/five-plane-state-evidence/truth | 84 | 已归档 |
| #28 | unit/platform/five-plane-orchestration/oapeflir | 50 | 已归档 |
| #29 | unit/platform/shared/cache | 35 | 已归档 |
| #30 | unit/platform/five-plane-interface/api | 52 | 已归档 |

**总计**: 354 个测试failed，分布在 16 个主要目录

---

## Mission v1.4 Architecture落地活动待办

> 来源：`docs_zh/reference/mission_architecture_design_review_v1_4_full_merged.md`。本主线按“文档Status回写 -> 契约冻结 -> Truth/Event -> Control Plane -> API/Runtime Binding -> P1/P2 能力 -> 测试收口”的顺序执lines。Mission 只作为长期目标vs治理上下文根对象，不成为执lines对象，不替代 `PlanGraphBundle / PlanNode / NodeRun / NodeAttempt`。

| 波iterations | 覆盖任务 | Status | 验收口径 |
|---|---|---|---|
| M0 文档vs任务台账 | T-MIS-001 至 T-MIS-019 Statustable、证据路径、测试路径 | [x] completed | Review 文档只追加Statusvs依据，不删除原始契约内容 |
| M1 Contract Freeze | T-MIS-001 | [x] completed | Mission schemas/types/errors/events 可export，严格 schema 测试via |
| M2 Truth/Event Foundation | T-MIS-002, T-MIS-003 | [x] completed | mission truth tables、repository、event sequence、platform.mission.* 同事务测试via |
| M3 Control Plane | T-MIS-004, T-MIS-005 | [x] completed | lifecycle CAS、resolver、governance、budget、live guard 定向测试via |
| M4 Interface/API | T-MIS-006 | [x] completed | `/api/v1/missions` create/list/read/patch、Status转换、members、tasks/runs/evidence/budget vs `/api/v1/mission-resolutions:dry-run` contract 测试via |
| M5 Runtime Binding | T-MIS-007, T-MIS-008, T-MIS-009, T-MIS-010 | [x] completed | Task create -> Mission resolution -> MissionSnapshot -> PlanGraphBundle -> HarnessRun -> NodeRun guard 链路测试via |
| M6 P1 能力 | T-MIS-011, T-MIS-012, T-MIS-013, T-MIS-014, T-MIS-015 | [x] completed | Mission Console 后端data面、观测、学习提升、legacy backfill、ADR 文档Status一致 |
| M7 P2 仓内基线 | T-MIS-016, T-MIS-017, T-MIS-018, T-MIS-019 | [x] completed | handoff、home region/fencing、outcome analytics、template/package integration 有可测试服务基线 |
| M8 测试vs收口 | Contract/Unit/Integration/E2E/Governance | [x] completed | Mission 定向测试、`npm run build:test` vs OpenAPI contract 测试via |

### T-MIS 映射

| 任务 | 本轮落点 | Status |
|---|---|---|
| T-MIS-001 | Mission Zod schemas vs type exports | [x] completed |
| T-MIS-002 | mission_records / memberships / snapshots / event_sequences migration | [x] completed |
| T-MIS-003 | `platform.mission.*` event schemas | [x] completed |
| T-MIS-004 | MissionLifecycleService + CAS transition | [x] completed |
| T-MIS-005 | MissionResolver + MissionGovernanceService | [x] completed |
| T-MIS-006 | Mission API + ErrorEnvelope（含 patch、members、tasks/runs/evidence/budget） | [x] completed |
| T-MIS-007 | PlanGraphBundle missionSnapshotRef required | [x] completed |
| T-MIS-008 | HarnessRun missionBinding required | [x] completed |
| T-MIS-009 | NodeRun MissionLiveGuard | [x] completed |
| T-MIS-010 | canonical Mission E2E 覆盖 | [x] completed |
| T-MIS-011 | Mission Console Overview / Members / Tasks / Runs / Budget / Evidence 后端data面 | [x] completed |
| T-MIS-012 | Mission trace/log correlation + metrics cardinality guard | [x] completed |
| T-MIS-013 | Mission scoped LearningObject promotion gate | [x] completed |
| T-MIS-014 | legacy Task/Session missionRef backfill | [x] completed |
| T-MIS-015 | ADR 更新vs superseded 标记 | [x] completed |
| T-MIS-016 | Mission handoff across org/tenant | [x] completed |
| T-MIS-017 | Mission home region + read replica routing/fencing | [x] completed |
| T-MIS-018 | Mission outcome analytics | [x] completed |
| T-MIS-019 | Mission template/package integration | [x] completed |
