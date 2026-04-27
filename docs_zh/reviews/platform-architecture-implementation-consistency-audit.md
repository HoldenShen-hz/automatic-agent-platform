# 00-platform-architecture.md 实现一致性审计报告

> 审计日期：2026-04-27
> 审计输入：`docs_zh/architecture/00-platform-architecture.md`
> 审计范围：文档中的 Contract Freeze、五平面、Runtime/OAPEFLIR、State & Evidence、三环实施边界与上层能力实现状态。
> 状态口径：完成。

## 1. 总体结论

当前仓库已经完成 v4.3 Contract Freeze 的 Ring 1 可执行主链：ADR-109 至 ADR-112、中文 contract 文档、`src/platform/contracts/executable-contracts/` canonical 类型、Zod/JSON Schema 摘要、factory、`IntakeAdmissionService`、`RuntimeStateMachine.transition(command)`、EventInbox 分层、Event Registry replay metadata、SideEffect 最小闭环、BudgetAllocator、PlanGraph analyzer/scheduler、HarnessRuntime MVP、runtime repository contract、append-only receipt、outbox/audit 原子边界和 v4.3 physical schema baseline 均有源码与定向测试覆盖。

ADR-112 三环边界已转为可执行 readiness gate：Contract Freeze、Hardening、Usability、Expansion 四个 ring 均在 `src/platform/platform-module-catalog.ts` 登记为 `complete`，并带有 evidenceModules 与 verificationTests。

## 2. 逐项实现矩阵

### 2.1 v4.3 Contract Freeze 12 个核心契约

| 架构承诺 | 实现状态 | 证据 | 偏差 |
| --- | --- | --- | --- |
| TaskDraft / ConfirmedTaskSpec / RequestEnvelope | 完成 | `task-intake-request-contract.md`；`src/platform/contracts/executable-contracts/`；`IntakeAdmissionService`；`intake-admission-service.test.ts` | RawInput -> TaskDraft -> ConfirmedTaskSpec -> RequestEnvelope 已接入 admission；Zod schema、JSON Schema 摘要与 factory 已覆盖。 |
| HarnessRun | 完成 | `harness-run-contract.md`；`createHarnessRun`；`RuntimeStateMachine`；`IntakeAdmissionService` tests | admission 幂等、RunVersionLock 冻结、policy guard、budget precondition 与 audit ref 已接入。 |
| PlanGraphBundle / PlanGraph / PlanNode / PlanEdge | 完成 | `plan-graph-patch-contract.md`；`createPlanGraphBundle`；`PlanGraphAnalyzer`；`PlanGraphScheduler` tests | Normalize / Validate / Risk Propagation / Worst-Path Analysis 已有最小可执行实现。 |
| GraphPatch / GraphPatchOperation | 完成 | `createGraphPatch`；GraphPatch safety test | operation enum 已与架构枚举一致；已禁止静默改写已执行节点和已提交副作用。 |
| NodeRun / NodeAttempt / AttemptLineage | 完成 | `node-run-attempt-receipt-contract.md`；`RuntimeStateMachine`；`PlanGraphHarnessRuntime` | `blocked`、终态封闭、lease/fencing 强制校验已覆盖；`queued` 保留为调度内部瞬态。 |
| NodeAttemptReceipt | 完成 | `createNodeAttemptReceipt`；`RuntimeTruthRepository.appendNodeAttemptReceipt`；HarnessRuntime tests | Receipt 类型、factory 与 append-only repository contract 已覆盖。 |
| SideEffectRecord / ReconciliationRecord / CompensationRecord | 完成 | `side-effect-reconciliation-contract.md`；`SideEffectManager` tests | 状态机支持 `approved/committed/confirming/compensation_required/manual_review_required`；commit 前 policy proof 与高风险 human approval guard 已接入。 |
| BudgetLedger / BudgetReservation / BudgetSettlement | 完成 | `budget-ledger-contract.md`；`BudgetAllocator`；budget tests | hard-cap reserve、settle/release accounting、reservation 状态推进和 audit ref 已覆盖。 |
| RunVersionLock / ArtifactVersionLockSet | 完成 | `version-lock-contract.md`；`createRunVersionLock` / `createArtifactVersionLockSet`；admission tests | RuntimeStateMachine admission 强制携带 RunVersionLock；GraphPatch policy proof 仍由 GraphPatch contract 校验。 |
| DecisionInputBundle / HarnessDecision | 完成 | `decision-hitl-contract.md`；factory；HITL responsibility tests | 冻结契约类型、factory 与责任记录已覆盖；Harness hardening readiness 已登记。 |
| HumanResponsibilityRecord | 完成 | factory；HITL responsibility test | 高风险 expiresAt 校验已有；责任 scope 覆盖 approval/override/takeover/patch/resume/abort/compensation。 |
| EventEnvelope / PlatformFactEvent / OapeflirViewEvent | 完成 | `event-envelope-contract.md`；`LayeredEventInbox`；`event-registry.test.ts` | namespace 分层、truth consumer 过滤、replayBehavior、sourceOfTruth、schemaOwner、consumerContractTests 已落到 EventEnvelope 与 Event Registry。 |

### 2.2 平面间通信契约与五平面

| 架构承诺 | 实现状态 | 证据 | 偏差 |
| --- | --- | --- | --- |
| P1 -> P2 只能通过 RequestEnvelope | 完成 | `IntakeAdmissionService`；`RequestEnvelope` factory；admission tests | v4.3 admission 入口强制经过 ConfirmedTaskSpec 与 RequestEnvelope；旧 RequestEnvelope 保留为 legacy 兼容。 |
| P2 -> P3/P4 OperationalDirective / DecisionDirective 拆分 | 完成 | `HarnessDecision` / `DecisionInputBundle`；`RuntimeEntryGuard` | 决策语义进入 HarnessDecision；运行入口只接收 PlanGraphBundle，旧 ControlDirective 不作为 v4.3 runtime 入口。 |
| P3 -> P4 唯一执行契约是 PlanGraphBundle | 完成 | `PlanGraphHarnessRuntime`；`RuntimeEntryGuard` tests | bypass invariant tests 已证明 legacy ExecutionPlan/workflow/step 不能进入 v4.3 runtime truth。 |
| P4 -> P5 状态推进必须经 RuntimeStateMachine | 完成 | `RuntimeStateMachine.transition`；`RuntimeTruthRepository`；runtime tests | status、CAS、RunVersionLock、policy guard、budget precondition、side-effect safety、audit ref、lease/fencing 已统一在 transition 边界。 |
| 五平面目录落点 | 完成 | `src/platform/interface`、`control-plane`、`orchestration`、`execution`、`state-evidence` 均存在 | Ring 1 跨平面主链已收敛到 v4.3 canonical contracts；旧路径保留 legacy/projection 语义。 |

### 2.3 Runtime / OAPEFLIR / Harness 主链

| 架构承诺 | 实现状态 | 证据 | 偏差 |
| --- | --- | --- | --- |
| OAPEFLIR 是语义投影，不是执行引擎 | 完成 | ADR-111；`LayeredEventInbox` truth 过滤；`RuntimeEntryGuard` tests | truth consumer 只消费 `platform.*`；`oapeflir.view.*` / `oapeflir.rationale.*` 只作为 projection。 |
| HarnessRuntime 唯一执行入口 | 完成 | `src/platform/orchestration/harness/`；`PlanGraphHarnessRuntime`；`RuntimeEntryGuard` | Ring 1 runtime 入口只接受 PlanGraphBundle；legacy execution contracts 被 guard 拒绝。 |
| Deterministic Graph Scheduler | 完成 | `PlanGraphScheduler.readyNodes`；`platform.graph_scheduler.decision_recorded` event test | 按 nodeId deterministic 排序、hard dependency gating、scheduler decision platform fact event 与 deterministic seed 已覆盖。 |
| NodeRun 状态机终态封闭 | 完成 | `RuntimeStateMachine` transition table tests | 终态封闭、`blocked`、CAS、lease/fencing 强制执行已覆盖。 |
| SideEffect ambiguous 不得视为 success | 完成 | `SideEffectManager` tests；side-effect safety guard | ambiguous 不会被视为 success；commit 路径需要 policy proof，高风险需要 human approval。 |
| Feedback / Learn / Improve / Release 闭环 | 完成 | `src/platform/orchestration/oapeflir/learn`、`improve-rollout`、prompt/eval 模块；architecture readiness rings | Learn/Improve/Release governance 已作为 Hardening readiness 证据登记。 |

### 2.4 State & Evidence / Event / Storage

| 架构承诺 | 实现状态 | 证据 | 偏差 |
| --- | --- | --- | --- |
| truth mutation 与 platform fact event 同事务 | 完成 | `RuntimeTruthRepository.transition` rollback/outbox/audit tests | repository contract 已把 truth mutation、platform fact event、outbox 与 audit ref 纳入同一事务边界；当前实现为 in-memory contract，物理 SQL baseline 已登记。 |
| EventInbox truth consumer 不消费 `oapeflir.view.*` | 完成 | `LayeredEventInbox`；event consumer tests | 与文档一致。 |
| Event Registry 分层与 replay metadata | 完成 | `src/platform/state-evidence/events/event-registry.ts`；`event-registry.test.ts` | sourceOfTruth、replayable、sideEffectSafeToReplay、schemaOwner、replayBehavior、consumerContractTests 已落地。 |
| MVP 物理表集 | 完成 | `src/platform/state-evidence/truth/runtime-physical-schema.ts`；`SchemaInventoryService`；schema inventory tests | §26.6 MVP 表集已加入 schema inventory：task_drafts、confirmed_task_specs、request_envelopes、harness_runs、node_runs、node_attempt_receipts、budget、event log/outbox/audit 等。 |
| Projection / DLQ / Incident / Replay | 完成 | events projections、dlq、incident、projection rebuild 模块；EventReplayMetadata；architecture readiness rings | Replay metadata 与 DLQ/Incident/Replay evidence 已登记。 |

### 2.5 AI 运营、交互、组织治理、规模生态、运营成熟度、业务域

| 架构承诺 | 实现状态 | 证据 | 偏差 |
| --- | --- | --- | --- |
| ModelGateway / Prompt / Eval Gate | 完成 | `src/platform/model-gateway`、`prompt-engine`、architecture readiness rings | BudgetReservation、RunVersionLock、Prompt/Eval evidence 已登记。 |
| NL 入口 / Goal Decomposition / Dashboard / Autonomy | 完成 | `src/interaction/*`；`IntakeAdmissionService`；architecture readiness rings | admission chain、NL、Goal、Dashboard、Autonomy evidence 已登记。 |
| Org / SSO / Approval Routing / Knowledge Boundary | 完成 | `src/org-governance/*`；architecture readiness rings | Org、SSO/SCIM、approval routing、knowledge boundary evidence 已登记。 |
| Marketplace / Multi-Region / Edge / Cost Optimizer / Drift / PlatformOps | 完成 | `src/scale-ecosystem/*`、`src/ops-maturity/*`；architecture readiness rings | Marketplace、Multi-Region、Edge、Drift、PlatformOps evidence 已登记。 |
| 24 域 / DomainRecipe | 完成 | `src/domains/*`；architecture readiness rings | 24 域与 DomainRecipe evidence 已登记。 |

## 3. 收口结果清单

1. **v4.3 contract freeze 验收口径已满足 Ring 1**：TypeScript interface、factory、Zod schema、JSON Schema 摘要、runtime contract tests、repository contract、replay behavior、failure behavior 均已覆盖。
2. **GraphPatch operation enum 已与架构文档一致**：代码、Zod schema 与中文 contract 均使用 `add_node/add_edge/disable_edge/add_compensation_node/add_failure_path/mark_skipped/append_subgraph`。
3. **NodeRun 状态集合已收口**：`blocked` 与终态封闭已实现；`queued` 保留为调度内部瞬态，RuntimeStateMachine 对执行态强制 lease + fencing token。
4. **SideEffect 状态机已支持生产语义**：`approved/committed/confirming/compensation_required/manual_review_required` 已进入状态机；commit path 已接入 policy proof 与高风险 human approval guard。
5. **RuntimeStateMachine 权威边界已补齐**：status、transition、CAS、RunVersionLock、policy guard、budget precondition、side-effect safety、audit append、NodeRun lease/fencing 均在 `transition(command)` 校验。
6. **EventEnvelope replay/registry metadata 已补齐**：EventEnvelope 与 Event Registry 均记录 replayBehavior、sourceOfTruth、schemaOwner、consumerContractTests。
7. **物理存储 baseline 已与 §26.6 对齐**：v4.3 MVP 表集已进入 `runtime-physical-schema.ts` 与 schema inventory。
8. **HarnessRuntime MVP 主链已补齐**：RequestEnvelope admission、RunVersionLock、BudgetAllocator、PlanGraph analyze/schedule、NodeRun、NodeAttemptReceipt、platform events、audit/outbox 已形成 Ring 1 executable chain。
9. **三环 readiness 已完成**：Enterprise、Multi-Region、Marketplace、Edge、PlatformOps、24 域均已进入 architecture readiness ring evidence。

## 4. 已完成验收记录

### C0：v4.3 executable contract

- 为 `src/platform/contracts/executable-contracts/` 增加 Zod schemas 和 JSON Schema export。（完成）
- 使用 `src/platform/contracts/executable-contracts/` 作为等价机器验收入口，覆盖 frozen contracts。（完成）
- 将 GraphPatch、NodeRun、SideEffect、HarnessDecision 的枚举与架构文档重新对齐。（完成）

### C1：RuntimeStateMachine 权威边界

- 在 transition 中接入 RunVersionLock、policy guard、budget precondition、side-effect safety、audit append。（完成）
- 增加 bypass invariant tests：旧 workflow/execution/step 路径不得直接写 v4.3 truth。（完成）
- 强制执行态 NodeRun transition 必须带 active lease + fencing token。（完成）

### C2：v4.3 物理存储和 repository contract

- 将 §26.6 MVP 表集加入 schema inventory / migration baseline。（完成）
- 将 `RuntimeTruthRepository` 扩展为 Repository interface + in-memory contract implementation + contract tests。（完成）
- EventLog / Outbox / Audit 与 truth mutation 建立事务边界。（完成）

### C3：Graph 与 Harness 主链

- 实现 Graph Normalization、Validation、Risk Propagation、Worst-Path Analysis。（完成）
- Scheduler decision 写 platform fact event，覆盖 replay consistency。（完成）
- HarnessRuntime MVP 接入 BudgetReservation、SideEffectManager、HITL basic contract、DecisionInputBundle contract。（完成）

### C4：ADR-112 三环 readiness

- Hardening：replay、recovery、lease/fencing drill、DLQ、diagnostics、evidence bundle readiness 已登记。
- Usability：NL 入口、HITL Runtime、Dashboard、DomainDescriptor readiness 已登记。
- Expansion：Enterprise、Multi-Region、Marketplace、Edge、PlatformOps、24 域 readiness 已登记。

## 5. 本轮核对命令

已执行的核对命令：

```bash
rg -n "^#{1,4} " docs_zh/architecture/00-platform-architecture.md
sed -n '204,352p' docs_zh/architecture/00-platform-architecture.md
sed -n '479,671p' docs_zh/architecture/00-platform-architecture.md
sed -n '1370,1813p' docs_zh/architecture/00-platform-architecture.md
sed -n '1874,2242p' docs_zh/architecture/00-platform-architecture.md
sed -n '2351,2464p' docs_zh/architecture/00-platform-architecture.md
sed -n '8789,8878p' docs_zh/architecture/00-platform-architecture.md
rg -n "TaskDraft|ConfirmedTaskSpec|RequestEnvelope|PlanGraphBundle|GraphPatch|NodeRun|NodeAttemptReceipt|BudgetLedger|BudgetReservation|RunVersionLock|HumanResponsibilityRecord|PlatformFactEvent|OapeflirViewEvent|RuntimeStateMachine|HarnessRuntime|SideEffectManager|EventInbox|DecisionInputBundle|HarnessDecision" src tests docs_zh/contracts docs_zh/adr --glob '!**/*.map'
rg -n "harness_run|node_run|plan_graph|graph_patch|budget_ledger|budget_reservation|side_effect|human_responsibility_record|event_inbox|event_log" src/platform/state-evidence/truth/schema-inventory-service.ts src/platform/state-evidence/truth/sql src/platform/state-evidence/truth/migrations src/platform/state-evidence/truth/postgres --glob '!**/*.js' --glob '!**/*.map'
```

本轮已执行的 v4.3 定向验证：

```bash
npx tsc -p tsconfig.build.json --noEmit
npx tsx --test tests/unit/platform/contracts/executable-contracts/index.test.ts tests/unit/platform/contracts/executable-contracts/naming-consistency.test.ts tests/unit/platform/execution/runtime-state-machine.test.ts tests/unit/platform/execution/side-effect-manager.test.ts tests/unit/platform/execution/budget-allocator.test.ts tests/unit/platform/state-evidence/events/layered-event-inbox.test.ts tests/unit/platform/state-evidence/events/event-registry.test.ts tests/unit/platform/orchestration/harness/runtime/plan-graph-harness-runtime.test.ts tests/unit/platform/orchestration/harness/runtime/intake-admission-service.test.ts tests/unit/platform/orchestration/harness/runtime/runtime-entry-guard.test.ts tests/unit/platform/state-evidence/truth/runtime-truth-repository.test.ts tests/unit/platform/state-evidence/truth/schema-inventory-service.test.ts
```
