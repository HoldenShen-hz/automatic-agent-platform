# 00-platform-architecture.md 实现一致性审计报告

> 审计日期：2026-04-27  
> 审计输入：`docs_zh/architecture/00-platform-architecture.md`  
> 审计范围：文档中的 Contract Freeze、五平面、Runtime/OAPEFLIR、State & Evidence、三环实施边界与上层能力实现状态。  
> 状态口径：完成 / 部分完成 / 不一致 / 未实现 / 超出 v4.3 MVP 范围。

## 1. 总体结论

当前仓库已经完成 v4.3 Contract Freeze 的最小可执行骨架：ADR-109 至 ADR-112、中文 contract 文档、`src/platform/contracts/v43/` canonical 类型与 factory、`RuntimeStateMachine.transition(command)`、EventInbox 分层、SideEffect 最小闭环、HarnessRuntime MVP 和 in-memory runtime repository 均有源码与定向测试覆盖。

但它尚未达到 `00-platform-architecture.md` 对“冻结契约必须具备 Zod/JSON Schema、状态机、事件清单、Repository API、contract test、replay behavior、failure behavior”的完整生产验收口径。当前更准确的状态是：Ring 1 MVP executable skeleton 已建立，生产级 schema、物理存储、完整 graph validation、budget allocator、replay/incident/DLQ、完整 Harness loop 与企业/24 域能力仍需后续批次补齐。

## 2. 逐项实现矩阵

### 2.1 v4.3 Contract Freeze 12 个核心契约

| 架构承诺 | 实现状态 | 证据 | 偏差 |
| --- | --- | --- | --- |
| TaskDraft / ConfirmedTaskSpec / RequestEnvelope | 部分完成 | `docs_zh/contracts/v4_3_task_intake_and_request_contract.md`；`src/platform/contracts/v43/index.ts` factory；`tests/unit/platform/contracts/v43/index.test.ts` | 类型与 factory 已有；尚未看到完整 IntakeService 将 RawInput -> TaskDraft -> ConfirmedTaskSpec -> RequestEnvelope 接入真实入口；无 Zod/JSON Schema。 |
| HarnessRun | 部分完成 | `v4_3_harness_run_contract.md`；`createHarnessRun`；`RuntimeStateMachine` tests | 状态机骨架已有；admission 幂等、RunVersionLock 冻结、P1/P2/P3 端到端 admission 未完整接入。 |
| PlanGraphBundle / PlanGraph / PlanNode / PlanEdge | 部分完成 | `v4_3_plan_graph_and_patch_contract.md`；`createPlanGraphBundle`；`V43GraphScheduler` | Graph 类型已有；Normalize / Validate / Risk Propagation / Worst-Path Analysis 只在文档，代码仅做最小节点校验和 hard dependency ready 判断。 |
| GraphPatch / GraphPatchOperation | 部分完成 / 不一致 | `createGraphPatch`；GraphPatch safety test | Safety 覆盖已执行节点/side effect；operation enum 与架构文档不完全一致，缺 `append_subgraph`、`add_failure_path` 等文档操作，新增了 `update_scheduler_policy`、`update_budget_intent` 等代码操作。 |
| NodeRun / NodeAttempt / AttemptLineage | 部分完成 / 不一致 | `v4_3_node_run_attempt_receipt_contract.md`；`RuntimeStateMachine`；`V43HarnessRuntimeMvp` | NodeRun 状态机可跑；代码引入 `queued`，文档 §14.10 未列出；AttemptLineage 类型存在，但 retry/redrive 追加链路未完整接入运行时。 |
| NodeAttemptReceipt | 部分完成 | `createNodeAttemptReceipt`；HarnessRuntime MVP test | Receipt 类型与 factory 已有；未形成持久 append-only receipt repository，也未完整关联 telemetry / duration / side effects / graph id 等文档字段。 |
| SideEffectRecord / ReconciliationRecord / CompensationRecord | 部分完成 / 不一致 | `v4_3_side_effect_reconciliation_contract.md`；`SideEffectManager` tests | 最小 reconciliation / compensation 可推进；状态机与 §14.11 不完全一致，代码使用 `reserved`，文档使用 `approved/committed/confirming/compensation_required/manual_review_required` 等。commit 前 approval/budget/policy/risk 复检未完整实现。 |
| BudgetLedger / BudgetReservation / BudgetSettlement | 部分完成 | `v4_3_budget_ledger_contract.md`；budget hard-cap test | 原子 hard-cap helper 已有；缺 BudgetAllocator、bucket/shard、streaming incremental reserve/settle、settlement/release 同事务事件完整链路。 |
| RunVersionLock / ArtifactVersionLockSet | 部分完成 | `v4_3_version_lock_contract.md`；`createRunVersionLock` / `createArtifactVersionLockSet` | 类型与 factory 已有；RuntimeStateMachine 未校验 RunVersionLock，admitted 时冻结和 GraphPatch override policy 未接入。 |
| DecisionInputBundle / HarnessDecision | 部分完成 | `v4_3_decision_and_hitl_contract.md`；factory；旧 Harness protocol tests | 类型与 factory 已有；文档要求的六种裁决和扩展裁决与代码 `decision` 枚举不完全一致，LoopController 尚未完全以 v4.3 DecisionInputBundle 为唯一输入。 |
| HumanResponsibilityRecord | 部分完成 | factory；HITL responsibility test | 高风险 expiresAt 校验已有；approve/reject/patch/override/takeover/resume 的真实 HITL scope 记录链路未完整接入。 |
| EventEnvelope / PlatformFactEvent / OapeflirViewEvent | 部分完成 | `v4_3_event_envelope_contract.md`；`V43EventInbox` tests | namespace 分层和 truth consumer 过滤已实现；缺 Event Registry metadata 字段（source_of_truth、replayable、side_effect_safe_to_replay、schema_owner、consumer_contract_tests）和 replayBehavior。 |

### 2.2 平面间通信契约与五平面

| 架构承诺 | 实现状态 | 证据 | 偏差 |
| --- | --- | --- | --- |
| P1 -> P2 只能通过 RequestEnvelope | 部分完成 | `src/platform/contracts/request-envelope/`；`src/interaction/nl-gateway/`；v4.3 RequestEnvelope factory | 新旧 RequestEnvelope 并存；未确认所有入口都强制经过 ConfirmedTaskSpec。 |
| P2 -> P3/P4 OperationalDirective / DecisionDirective 拆分 | 部分完成 | `src/platform/contracts/control-directive/`；v4.3 HarnessDecision | Decision 侧开始收敛；OperationalDirective v4.3 canonical type 未进入 `src/platform/contracts/v43/`，旧 ControlDirective 仍是主要代码落点。 |
| P3 -> P4 唯一执行契约是 PlanGraphBundle | 部分完成 | `V43HarnessRuntimeMvp` 只消费 PlanGraphBundle | 旧 workflow / execution / step 路径仍大量存在；尚无 dispatch guard 证明 P4 拒绝 legacy ExecutionPlan/steps。 |
| P4 -> P5 状态推进必须经 RuntimeStateMachine | 部分完成 | `RuntimeStateMachine.transition`；`V43RuntimeRepository` | v4.3 新路径满足；旧执行引擎和 repository 仍可能直接写旧 truth，缺统一 bypass invariant test。 |
| 五平面目录落点 | 部分完成 | `src/platform/interface`、`control-plane`、`orchestration`、`execution`、`state-evidence` 均存在 | 目录覆盖完整；跨平面通信还没有完全收敛到 v4.3 canonical contracts。 |

### 2.3 Runtime / OAPEFLIR / Harness 主链

| 架构承诺 | 实现状态 | 证据 | 偏差 |
| --- | --- | --- | --- |
| OAPEFLIR 是语义投影，不是执行引擎 | 部分完成 | ADR-111；`V43EventInbox` truth 过滤；`src/platform/orchestration/oapeflir/` 旧服务 | 事件分层已明确；旧 OAPEFLIR loop/execution bridge 仍存在，需要 adapter/legacy 标记和 bypass 测试。 |
| HarnessRuntime 唯一执行入口 | 部分完成 | `src/platform/orchestration/harness/`；`V43HarnessRuntimeMvp` | Harness 服务较丰富；v4.3 MVP 只覆盖单 ready node 执行，未证明所有执行入口统一进入 HarnessRuntime。 |
| Deterministic Graph Scheduler | 部分完成 | `V43GraphScheduler.readyNodes` | 当前按 nodeId 排序和 hard dependency 判断；未记录 scheduler decision event，未纳入 priority/risk/critical_path/worker snapshot/seed。 |
| NodeRun 状态机终态封闭 | 部分完成 / 不一致 | `RuntimeStateMachine` transition table tests | 终态封闭实现存在；状态集合和文档有偏差，lease/fencing 只在 NodeRun 已有 lease 时校验，未强制所有执行态迁移必填。 |
| SideEffect ambiguous 不得视为 success | 部分完成 | `SideEffectManager` tests | ambiguous 路径不直接成功；真实外部 commit、reconciliation worker、manual review 与 incident 还未完整实现。 |
| Feedback / Learn / Improve / Release 闭环 | 部分完成 / 超出 MVP | `src/platform/orchestration/oapeflir/learn`、`improve-rollout`、prompt/eval 模块 | 多数模块存在，但未与 v4.3 HarnessDecision、EvaluationGate 和 Release governance 形成统一 executable chain。 |

### 2.4 State & Evidence / Event / Storage

| 架构承诺 | 实现状态 | 证据 | 偏差 |
| --- | --- | --- | --- |
| truth mutation 与 platform fact event 同事务 | 部分完成 | `V43RuntimeRepository.transition` in-memory rollback test | in-memory 原子边界已验证；物理 DB transaction、outbox、audit ref 未进入 v4.3 runtime repository。 |
| EventInbox truth consumer 不消费 `oapeflir.view.*` | 完成 | `V43EventInbox`；event consumer tests | 与文档一致。 |
| Event Registry 分层与 replay metadata | 部分完成 | `src/platform/state-evidence/events/event-registry.ts`；v4.3 EventEnvelope helpers | namespace 分层实现；v4.3 metadata/replayBehavior/consumer_contract_tests 未完整落到事件注册表。 |
| MVP 物理表集 | 未实现 / 不一致 | `rg` 未发现 `task_draft`、`confirmed_task_spec`、`harness_run`、`node_run` 等 v4.3 表名落在 schema inventory / migrations | 现有存储仍以旧 schema 和 `harness_runs` durable 表为主；§26.6 的 v4.3 physical baseline 未落库。 |
| Projection / DLQ / Incident / Replay | 部分完成 | events projections、dlq、incident、projection rebuild 模块存在 | 模块存在但未与 v4.3 EventEnvelope / RuntimeStateMachine / ReplaySandboxPolicy 完整闭环。 |

### 2.5 AI 运营、交互、组织治理、规模生态、运营成熟度、业务域

| 架构承诺 | 实现状态 | 证据 | 偏差 |
| --- | --- | --- | --- |
| ModelGateway / Prompt / Eval Gate | 部分完成 | `src/platform/model-gateway`、`prompt-engine`、tests | 模块存在；未完全接入 v4.3 BudgetReservation、RunVersionLock、PromptExecutionRecord。 |
| NL 入口 / Goal Decomposition / Dashboard / Autonomy | 部分完成 | `src/interaction/*` | 组件和测试存在；与 v4.3 intake/request/harness admission 的强制链路未完全统一。 |
| Org / SSO / Approval Routing / Knowledge Boundary | 部分完成 / Ring 2 | `src/org-governance/*` | 模块丰富；按 ADR-112 属 Hardening/Usability 后续范围，不阻塞 Ring 1。 |
| Marketplace / Multi-Region / Edge / Cost Optimizer / Drift / PlatformOps | 部分完成 / Ring 3 | `src/scale-ecosystem/*`、`src/ops-maturity/*` | 目录与基础服务存在；按 §三环属于扩张环，不能认定为 v4.3 MVP 完成。 |
| 24 域 / DomainRecipe | 部分完成 / Ring 3 | `src/domains/*` 目录覆盖多域 | 多域目录已存在，但 §38 四阶段门禁、24 域全量生产验收未完成。 |

## 3. 主要不一致清单

1. **v4.3 contract freeze 的验收口径尚未完全满足**：当前是 TypeScript interface + factory + unit tests；缺 Zod/JSON Schema、runtime-contracts 包、完整 repository contract test、replay behavior 和 failure behavior 注册。
2. **GraphPatch operation enum 与架构文档不一致**：文档定义 `add_node/add_edge/disable_edge/add_compensation_node/add_failure_path/mark_skipped/append_subgraph`；代码使用 `disable_unstarted_node/skip_pending_path/append_repair_node/update_scheduler_policy/update_budget_intent` 等。2026-04-27 实现批次 1 已修复：代码、Zod schema 与中文 contract 已改为架构枚举。
3. **NodeRun 状态集合不一致**：代码增加 `queued`，文档 §14.10 未列；代码无 `blocked`，文档状态图包含 `blocked`。2026-04-27 实现批次 1 已补齐 `blocked` 及其状态迁移；`queued` 暂保留为调度内部瞬态，后续需决定是否回写架构说明或改为 projection。
4. **SideEffect 状态机不一致**：代码使用 `reserved`，文档使用 `approved/committed/confirming/compensation_required/manual_review_required` 等生产语义。
5. **RuntimeStateMachine 校验不足**：实现了 status、transition、CAS、NodeRun lease/fencing 的最小校验；未统一校验 RunVersionLock、policy guard、budget precondition、side-effect safety、audit append。
6. **EventEnvelope 缺 replay/registry 元数据**：文档要求 replayBehavior、source_of_truth、schema_owner、consumer_contract_tests 等；v4.3 EventEnvelope 目前只有基础信封字段。
7. **物理存储未与 §26.6 对齐**：尚未看到 v4.3 MVP 表名进入 schema inventory/migration；当前 v4.3 repository 是 in-memory 实现。
8. **HarnessRuntime MVP 尚未等同生产主链**：已能 PlanGraphBundle -> Scheduler -> NodeRun -> NodeAttemptReceipt -> events；但未接入 RequestEnvelope admission、Budget pre-reserve、Tool/LLM/HITL/Subgraph executor、Audit/Evidence 持久化和 Evaluator/Decision 闭环。
9. **三环边界需要继续保持**：Enterprise、Multi-Region、Marketplace、Edge、PlatformOps、24 域不应被标为 v4.3 MVP 完成，只能算已有模块/后续范围。

## 4. 建议优先级

### P0：把 v4.3 契约变成真正 executable contract

- 为 `src/platform/contracts/v43/` 增加 Zod schemas 和 JSON Schema export。（2026-04-27 实现批次 1 已完成最小 executable contract package）
- 建立 `runtime-contracts/` 或等价机器验收入口，覆盖 12 个 frozen contract。
- 将 GraphPatch、NodeRun、SideEffect、HarnessDecision 的枚举与架构文档重新对齐，或回写 ADR 明确代码口径。（GraphPatch 已对齐；NodeRun 已补 `blocked`）

### P1：补齐 RuntimeStateMachine 的权威边界

- 在 transition 中接入 RunVersionLock、policy guard、budget precondition、side-effect safety、audit append。
- 增加 bypass invariant tests：旧 workflow/execution/step 路径不得直接写 v4.3 truth。
- 强制执行态 NodeRun transition 必须带 active lease + fencing token。

### P2：落地 v4.3 物理存储和 repository contract

- 将 §26.6 MVP 表集加入 schema inventory / migration / rollback。
- 将 `V43RuntimeRepository` 从 in-memory 扩展为 Repository interface + SQLite implementation + contract tests。
- EventLog / Outbox / Inbox / Audit 与 truth mutation 建立真实事务边界。

### P3：补齐 Graph 与 Harness 主链

- 实现 Graph Normalization、Validation、Risk Propagation、Worst-Path Analysis。
- Scheduler decision 写 platform fact event，覆盖 replay consistency。
- HarnessRuntime MVP 接入 BudgetReservation、SideEffectManager、HITL basic、Evaluator/DecisionInputBundle。

### P4：后续环继续按 ADR-112 推进

- Hardening：replay、recovery、lease/fencing drill、DLQ、diagnostics、evidence bundle。
- Usability：NL 入口、HITL Runtime、Dashboard、DomainDescriptor 试点。
- Expansion：Enterprise、Multi-Region、Marketplace、Edge、PlatformOps、24 域。

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
npx tsx --test tests/unit/platform/contracts/v43/index.test.ts tests/unit/platform/contracts/v43/naming-consistency.test.ts tests/unit/platform/execution/runtime-state-machine.test.ts tests/unit/platform/execution/side-effect-manager.test.ts tests/unit/platform/state-evidence/events/v43-event-inbox.test.ts tests/unit/platform/orchestration/harness/runtime/v43-harness-runtime.test.ts tests/unit/platform/state-evidence/truth/v43-runtime-repository.test.ts
```
