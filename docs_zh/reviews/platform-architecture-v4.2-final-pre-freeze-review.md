# 企业级 Agent 平台总体架构 v4.2 — 冻结前终审 Review 与改善方案

> 审查对象：`《企业级 Agent 平台总体技术架构设计文档》v4.2 可实现规格收敛版 / Release Candidate`  
> 审查目标：尽量在冻结前发现剩余架构、契约、状态机、运行时、存储、治理、路线图和文档结构问题。  
> 审查口径：不再重点讨论“是否应该做 Agent 平台”，而是检查这份架构是否已经足够作为生产实现规格、测试规格和团队协作边界。  
> 总体判断：v4.2 已经完成关键方向收敛，但仍不建议冻结。下一版应定位为 **v4.3 Executable Specification Freeze / Contract Freeze**，并将主文档拆分为核心架构、运行时可执行契约、状态事件证据、AI 治理、领域框架、运营企业化六份权威文档。

---

## 0. 总体结论

v4.2 已经吸收了前几轮最核心的修正：HarnessRuntime 权威化、HarnessRun 唯一 Run、PlanGraphBundle 替代线性 ExecutionPlan、OAPEFLIR 降级为语义投影、Trace Replay 默认、Budget atomic reserve、SideEffect reconciliation、Multi-Region single-leader per partition、TrustScore 不降低 inherent risk、Panic 不自动解除。这些方向是正确的。

但终审发现，文档仍存在三类冻结风险：

1. **权威契约还没有完全唯一化**：正文已经声明新模型，但 `RequestEnvelope`、`ExecutionReceipt`、`workflow_run`、`stepId`、`tasks`、`oapeflir_*` 等旧名仍出现在关键路径。实现团队很容易各自选择一套语义，最终形成双运行时。
2. **运行时不变量还没有全部落到机器可执行规格**：很多地方说“必须”，但没有指定 enforcement point、状态机入口、事件名、表字段、契约测试和失败行为。
3. **MVP 与目标态仍混排**：文档已经给出 Ring 1 MVP，但基础章节、表集、Domain、Marketplace、Edge、多模态、PlatformOps 等仍像同一层级承诺，容易把 8-12 周 MVP 拖回 18 个月目标态。

最终建议：**v4.3 不再新增能力，只做冻结、裁剪、拆文档、补测试矩阵。**

---

## 1. 冻结前必须解决的 25 个 Blocker

| 编号 | 严重级别 | 问题 | 影响 | 改善方案 |
|---|---:|---|---|---|
| B1 | Critical | 权威源声明仍冲突：正文称 Core Architecture 权威，但优先级又把 Executable Runtime Contract / Schema / Event Registry 放在正文前。 | 团队在冲突时会静默选择不同依据。 | 拆成 `Human Architecture Authority` 与 `Machine Execution Authority`；冲突必须开 ADR/PR 修正文档，不允许实现方自行裁决。 |
| B2 | Critical | 缺少唯一状态推进器的正式契约。 | P2/P3/P4/Recovery/HITL 都可能直接写 truth。 | 增加 `RuntimeStateMachine.transition(command)`，任何 HarnessRun / NodeRun / SideEffect / Budget 状态变更只能经该入口。 |
| B3 | Critical | `RequestEnvelope` 仍过早承接自然语言和未确认任务。 | 用户自然语言可能直接进入执行准入链。 | 增加 `RawInput → TaskDraft → ClarificationSession → ConfirmedTaskSpec → RequestEnvelope`。只有 ConfirmedTaskSpec 可生成 RequestEnvelope。 |
| B4 | Critical | `ExecutionReceipt` 仍以 `stepId` 为核心字段。 | NodeRun / AttemptLineage / GraphPatch 的审计链不完整。 | 改为 `NodeAttemptReceipt`，字段必须包含 `harnessRunId / planGraphId / nodeRunId / attemptId / graphVersion`。 |
| B5 | Critical | `HarnessStep.stepId`、`WorkProduct.stepId` 仍保留旧 step 语义。 | 语义 step 与可执行 NodeRun 容易混淆。 | `HarnessStep` 改为 semantic trace step；执行事实统一用 `nodeRunId` 和 `attemptId`。 |
| B6 | Critical | GraphPatch 只描述“追加式变更”，缺少机器可校验 schema。 | Replan 可能改变已执行路径语义，破坏审计和 replay。 | 定义 `GraphPatchOperation` 闭合枚举：add_node、add_edge、disable_edge、add_compensation_node、add_failure_path、mark_skipped、append_subgraph；禁止 delete executed node。 |
| B7 | Critical | GraphPatch 与副作用联动不够硬。 | 已提交或 ambiguous side effect 的下游路径可能被错误跳过。 | Patch 必须声明 `affectedExecutedNodes`、`affectedSideEffects`、`compatibilityClass`、`compensationPlanRef`。 |
| B8 | Critical | Budget 分片可能穿透全局 hard cap。 | 多 bucket 并发 reserve 可超过 tenant/monthly hard limit。 | 增加 `BudgetAllocator`：先把 global hard cap 原子分配到 bucket quota；bucket 内 reserve；周期 reconciliation 不得提高上限。 |
| B9 | Critical | Budget 与 UsageRecord 存在双账本。 | 成本报表、预算强制和 provider 发票可能互相冲突。 | 明确 `BudgetLedger` 是运行预算事实，`UsageRecord` 是 provider usage evidence；chargeback 以 settlement 为准，provider invoice 只用于对账。 |
| B10 | Critical | MVP 表集缺少 lease，一致性硬约束无法落地。 | CAS + Lease + Fencing 只停留在口号。 | MVP 表集加入 `lease_record` 或在 `node_run` 内嵌 lease 字段并定义唯一索引、TTL 扫描和 reclaim 事件。 |
| B11 | Critical | MVP 表集重复 `audit_record`，且 `execution_lease` 被放在 Hardening。 | 表集版本不可执行，测试会出现歧义。 | 去重 `audit_record`；将 lease 放入 MVP；Hardening 只增强 worker lease / distributed lease。 |
| B12 | Critical | LLM stream partial response 仍用“≥80% 预期长度”。 | 80% JSON/SQL/PlanGraph/代码可能完全不可用甚至危险。 | 改为格式感知完整性：JSON parse、schema valid、PlanGraph terminal reachable、SQL dry-run、代码编译/测试、决策输出完整。 |
| B13 | Critical | P4 仍通过 `ExecutionReceipt` 回报，§13/§14/§45 混用 receipt 名称。 | 执行层会实现 step receipt 而非 node attempt receipt。 | 统一命名：`NodeAttemptReceipt`；旧 `ExecutionReceipt` 仅 legacy adapter 输出。 |
| B14 | Critical | OAPEFLIR 事件有大量 `oapeflir.node.* / side_effect.* / budget.*` 名称，虽然声明不得作为 truth，但命名很像事实事件。 | 新 projector 可能误订阅 oapeflir 事件恢复 truth。 | 将语义投影事件统一改名为 `oapeflir.view.*` 或 `oapeflir.rationale.*`；truth facts 只允许 `platform.*`。 |
| B15 | Critical | `RuntimeInvariant` 不可覆盖，但 `super_admin` 可修改全局护栏。 | 最高权限可能绕过不可侵犯不变量。 | 定义 `NonOverridableInvariantRegistry`，super_admin 只能配置策略，不能禁用 runtime invariant。 |
| B16 | High | API 资源仍以 `/tasks`、`workflow-runs` 为主。 | 外部集成会绑定 legacy 资源。 | 写入口统一为 `/api/v1/harness-runs`；`tasks` 是 intent projection，`workflow-runs` 是 legacy read projection。 |
| B17 | High | Metrics / tracing 仍使用 `agent.execution`、`workflow_run`、`step`。 | 可观测性与运行时权威模型不一致。 | 指标改为 `harness.run.*`、`harness.node_run.*`、`harness.node_attempt.*`；legacy metrics 只由 adapter 派生。 |
| B18 | High | StructuredLog plane enum 出现 `X1-X2`，但架构只定义 X1。 | 日志字段不闭合，后续查询和告警口径混乱。 | 明确定义 X2，或移除 X2；建议拆为 `crosscutting_fabric: reliability/security/governance`。 |
| B19 | High | Risk factor 没有 factor_value 标尺。 | 不同域对 impact/irreversibility 等打分不可比较。 | 增加风险校准表：0/1/3/5 分定义、示例、审批人、证据要求。 |
| B20 | High | `critical risk + break-glass + side effect 禁止` 的关系不清。 | critical 是否可 break-glass 执行不可逆动作存在歧义。 | 明确 critical 默认 deny；break-glass 只允许受限、限时、双人审批、forensic logging，并不得绕过 SideEffectManager。 |
| B21 | High | PromptBundle rollback 只影响新 run，in-flight 高风险 canary 可能继续使用坏 bundle。 | 已知坏版本仍在长任务中执行。 | 增加 `BundleRevocationSeverity`: soft(new only)、checkpoint_switch、forced_pause、forced_abort。 |
| B22 | High | Eval Dataset “不少于 50 条”对 critical 域远远不够。 | 医疗、法务、金融、HR 无法靠 50 条样本证明安全。 | 按风险分级：low≥50、medium≥200、high≥500、critical≥1000 + 专家签核 + holdout。 |
| B23 | High | Multi-agent 协作状态机与消息类型不一致。 | `created → offered → accepted` 与 `task_request → task_offer → task_accept` 语义倒置。 | 改为 `capability_discovery → task_proposal → bid/decline → award → accept → child_run_created → report → verify → close`。 |
| B24 | High | Domain 24 域像说明文，缺可机器校验的 domain lint。 | 领域接入文档漂亮但不可验收。 | 每个 domain spec 必须通过：risk action coverage、HITL coverage、tool permission coverage、eval coverage、SLO profile、data boundary lint。 |
| B25 | High | 主文档仍过大且章节编号不连续。 | 冻结后维护成本极高，PR 容易冲突。 | 拆分主文档，主文档只保留核心架构和引用；24 域、ADR、附录、Executable Spec 拆出。 |

---

## 2. 逐节 Review 与改善方案

### 前言 / 目录 / 权威源

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 权威源排序与“Core Architecture 唯一权威源”矛盾。 | 冲突时各团队自行选择。 | 定义两类权威：人类架构权威=Core Architecture；机器执行权威=Contract/Schema/Event Registry。 |
| 目录仍承载 70+ 节、24 域、附录 H、路线图、ADR。 | 主文档无法稳定维护。 | 拆为 6 个文档：Core、Runtime Contract、State/Event、AI Ops、Domain Framework、Enterprise Ops。 |
| 旧 Phase、三环、Ring、Phase 8d、Phase 9 同时存在。 | 排期决策不唯一。 | 主路线只保留 MVP/Hardening/Enterprise；旧 Phase 放迁移附录。 |

### §1 文档概述

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 目标态和 MVP 边界混排。 | MVP 需求失控。 | 每节增加 `maturity: MVP/Hardening/Enterprise/Future`、`blocking_for_mvp`、`owner_team`、`acceptance_tests`。 |
| 文档目标仍包含 24 域全覆盖。 | 平台内核冻结被域内容阻塞。 | §1 只声明领域框架，不承诺 24 域在主架构内全部落地。 |

### §2 平台根假设与设计目标

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 设计宪法已有，但 invariant coverage 不完整。 | 口号化。 | 增加 `Invariant Coverage Matrix`：Invariant、Enforcement Point、Test Type、Failure Behavior、Phase。 |
| “默认收敛”没有统一冲突裁决顺序。 | 多个 guardrail 同时触发时行为不确定。 | 统一优先级：panic > security deny > budget exhausted > policy deny > side-effect ambiguous > HITL > replan > retry > accept。 |

### §3 平台定义与非目标

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 非目标说平台不替代专业责任人，但垂直域章节可能暗示 Agent 完成最终业务决策。 | 医疗、法务、金融、HR 等责任风险。 | 所有高风险域统一增加：“Agent 只生成候选、证据、草稿或受控动作请求，最终责任主体必须是授权人/系统。” |

### §4 总体架构

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 总图中 P4 / P5 / X1 章节引用不准确。 | 读者误判职责归属。 | 重画引用：P4 指 §14/§45/§57/§62；P5 指 §25-§29；X1 拆可靠性/安全/治理。 |
| X1 范围过大。 | 横切系统变成万能筐。 | 拆成 `ReliabilityFabric`、`SecurityFabric`、`GovernanceFabric`。 |

### §5 平面间通信契约

| 问题 | 风险 | 改善方案 |
|---|---|---|
| `RequestEnvelope` 同时承接自然语言、Webhook、已确认任务。 | 高风险误执行。 | 新增 TaskDraft / ConfirmedTaskSpec。 |
| `ExecutionReceipt.stepId` 残留。 | NodeRun attempt 链断裂。 | 改为 NodeAttemptReceipt。 |
| `PlanGraphBundle` 定义较好，但 GraphPatch operation 未闭合。 | 实现随意扩展。 | 定义 GraphPatchOperation 枚举和 JSON schema。 |
| OperationalDirective / DecisionDirective 已拆，但旧 `ControlDirective` 仍多处可见。 | 新旧 schema 并存。 | 保留在术语表和迁移附录即可，正文关键路径删除旧名。 |

### §6 API 契约与版本化

| 问题 | 风险 | 改善方案 |
|---|---|---|
| API 未把 HarnessRun / NodeRun / SideEffect / BudgetReservation / Replay 作为一等资源。 | UI/SDK 继续围绕 task/workflow。 | 增加 `/harness-runs`、`/harness-runs/{id}/nodes`、`/side-effects`、`/budget-reservations`、`/replay-sessions`。 |
| 错误响应缺 recoverability 和 side-effect state。 | 操作者不知道 retry/replan/compensate。 | 错误结构加入 retryable、recoverability、side_effect_state、operator_action。 |
| Webhook retry 虽补充，但需和 idempotency / inbox 绑定。 | 重复投递可能触发重复副作用。 | Webhook consumer 必须有 `event_inbox` 和 dedupe key。 |

### §7 服务通信架构

| 问题 | 风险 | 改善方案 |
|---|---|---|
| Outbox poller 热备/lease TTL 仍不够落地。 | Projection lag 和 webhook delivery gap 超 SLO。 | 指定 TTL≤10s、heartbeat≤3s、failover gap SLO≤15s、hot-standby poller。 |
| 异步事件 at-least-once 已写，但 inbox pattern 不够突出。 | consumer 幂等各自实现，质量不一。 | 每个 projection / webhook / DLQ redrive consumer 必须使用 `event_inbox`。 |

### §8 可扩展性架构

| 问题 | 风险 | 改善方案 |
|---|---|---|
| S1/S2/S3/S4 与 MVP/Hardening/Enterprise 仍重复。 | 扩展路线不唯一。 | 保留容量维度表；实施路线只引用三环。 |
| SQLite + Redis cache 的一致性边界不清。 | Redis 可能被误作 truth。 | 明确 Redis 仅缓存/队列/ephemeral lock，不存 truth。 |

### §9 稳定性架构

| 问题 | 风险 | 改善方案 |
|---|---|---|
| mode 优先级已写，但 mode scope 未定义。 | tenant/domain/run/node 级 mode 互相覆盖。 | 定义 ModeScope：platform > region > tenant > domain > run > node，最严格胜出。 |
| 自动恢复条件仍抽象。 | 模式震荡。 | 每个 mode switch 必须声明 cooldown、stable window、rollback criteria。 |

### §10 风险控制架构

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 风险因子没有取值标尺。 | 跨域风险不可比较。 | 每个因子定义 0/1/3/5 评分标准。 |
| risk_level 动作矩阵仍允许 medium 自动执行。 | 对部分域 medium 仍可能高影响。 | medium 默认自动仅限 reversible/read/write-limited；DomainRiskProfile 可上调到 high。 |
| critical 的 break-glass 与 side effect 禁止关系不清。 | break-glass 被滥用。 | critical 默认 deny；break-glass 只能限时、限 scope、双人审批、强审计、可追责。 |

### §11 安全可靠架构

| 问题 | 风险 | 改善方案 |
|---|---|---|
| Sandbox 技术实现过于假设 seccomp/容器可用。 | 跨平台不可落地。 | 定义 SandboxCapabilityMatrix：Linux/container/native/windows/mac 各自可用能力和降级策略。 |
| Plugin signing / SBOM 写了要求，但无 trust root 和 revocation。 | 被盗签名或恶意插件无法吊销。 | 增加 PluginTrustStore、key rotation、signature revocation list、quarantine policy。 |
| 数据分级只描述影响，不描述传播。 | 派生数据可能降级泄露。 | 增加 DataTaintPropagation：输出 data_class ≥ 输入最高 data_class，除非有显式脱敏证明。 |

### §12 异常事件处理

| 问题 | 风险 | 改善方案 |
|---|---|---|
| metrics 仍多为 `agent.*`、`workflow_run`、`step`。 | 新旧可观测性不一致。 | 改成 `harness.*`，legacy 由 adapter 派生。 |
| tracing span 仍是 workflow_run/oapeflir_cycle/execution(step)。 | 调试时看不到 NodeRun/AttemptLineage。 | 改为 HarnessRun → StageRationale → PlanGraph → NodeRun → NodeAttempt → Tool/LLM/HITL/SideEffect。 |
| `plane=P1-P5/X1-X2` 中 X2 未定义。 | 日志枚举不闭合。 | 删除 X2 或正式定义。 |
| DLQ replay 与 side effect 关系虽提到 simulation，但缺默认策略。 | DLQ 重放触发二次副作用。 | 默认 DLQ redrive 先 trace replay + simulation；只有 side_effect_safe_to_replay=true 才允许真实 redrive。 |

### §13 OAPEFLIR 受控认知框架

| 问题 | 风险 | 改善方案 |
|---|---|---|
| Execute 阶段仍输出 `ExecutionReceipt`。 | 与 NodeAttemptReceipt 冲突。 | Execute 输出改为 NodeAttemptReceipt / NodeRunEvent。 |
| OAPEFLIR 事件命名像 truth。 | projection 误用。 | 重命名为 rationale/view 事件。 |
| Graph Validation 支持“受控循环”，但循环语义未定义。 | 循环任务可绕过 max_steps。 | 定义 LoopNode：max_iterations、budget_per_iteration、termination_condition、loop_evidence。 |
| Worst-Path Analysis 没有条件分支保守规则。 | 低估成本/时延/审批等待。 | 未知概率按 worst-case；可选路径按最大成本路径；并行 join 按 max latency + sum cost。 |

### §14 Runtime Execution Plane

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 核心职责仍写 session/task/workflow_run/execution。 | legacy 语义残留。 | 改为 HarnessRun / PlanGraph / NodeRun / NodeAttempt / SideEffect。 |
| Dispatcher 因子仍写 step。 | 实现以 step 调度。 | 改为 node capability、node risk、node budget、node sandbox。 |
| NodeRun retry_wait 是否终态不清。 | retry sweeper 语义混乱。 | 明确 retry_wait 非终态，必须有 wakeAt / retryPolicy / attempt lineage。 |
| compensated 作为 NodeRun 终态可能混淆“原动作成功后补偿”与“节点执行补偿成功”。 | 审计语义歧义。 | NodeRun 终态保留 succeeded/failed/aborted；compensation 作为 SideEffect/CompensationRecord 状态。若保留 compensated，必须定义含义。 |

### §15 LLM Provider

| 问题 | 风险 | 改善方案 |
|---|---|---|
| ModelGateway 接口表没有 `stream()`，但后文定义 stream 行为。 | SDK 契约不完整。 | 在接口中加入 `stream()`，并定义 chunk schema、abort、resume、partial validation。 |
| partial response 使用长度阈值。 | 危险输出被接受。 | 改为 schema-aware completeness。 |
| Provider routing 输入有 `pii_output_possible`，但输出后处理不足。 | 跨境输出生成 PII。 | LLM response 后必须做 PII/secret scan；跨境输出含 PII 时隔离、清洗、incident。 |
| LLM 降级时 Eval / Judge 策略未完全绑定 rollout。 | canary 在 judge 不可靠时继续。 | D1+ 默认暂停 canary promotion；D2+ 禁止依赖 LLM judge 的质量晋升。 |

### §16 Prompt 管理

| 问题 | 风险 | 改善方案 |
|---|---|---|
| PromptBundle revocation 只影响新 run。 | 已知坏 Prompt 继续在 in-flight run 执行。 | 引入 soft/hard revocation。高风险 bundle 回滚可强制 pause in-flight run。 |
| Prompt Injection Classifier 阈值固定 0.7。 | 没训练数据/误报漏报目标。 | 分类器必须有 dataset、precision/recall、red-team set、更新周期；未达标只能作为辅助信号。 |
| Full Prompt Logging 与敏感数据最小化冲突。 | 调试日志泄露。 | 默认记录 prompt hash + redacted prompt + variable refs；完整 prompt 需 break-glass。 |

### §17 模型评估与质量门禁

| 问题 | 风险 | 改善方案 |
|---|---|---|
| Eval 样本数量对 critical 风险不足。 | 质量门禁虚假安全。 | 按风险/域设置最小样本和专家审查。 |
| LLM-as-Judge 作为补充已正确，但缺 judge drift 监控。 | Judge 自身退化不可见。 | Judge 模型也必须有 eval、calibration、bias/drift monitoring。 |
| Canary rollback 指标不包含 side-effect ambiguous rate。 | 副作用不确定性无法阻断发布。 | 加入 `ambiguous_side_effect_rate`、`manual_review_rate`、`policy_denial_spike`。 |

### §18 成本管理

| 问题 | 风险 | 改善方案 |
|---|---|---|
| UsageRecord 与 BudgetLedger 事实来源冲突。 | 对账和 chargeback 混乱。 | Budget settlement 为财务事实；UsageRecord 为 provider evidence。 |
| Streaming partial settlement 只一笔带过。 | 长输出可超预算。 | stream 每 N tokens 做 incremental reserve/settle；超限自动 stop generation。 |
| BudgetReservation 缺 reserved resource type。 | cost/token/duration/step 混在一个 estimate。 | reservation 增加 resource_type: money/model_tokens/context_tokens/output_tokens/tool_calls/human_review。 |

### §19 Agent 委托与协作

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 协作状态机与消息类型不自然。 | 乱序、重复、竞标不清。 | 改为 discovery/proposal/bid/award/accept/run/report/verify/close。 |
| 广播委托聚合最优结果缺投票/仲裁规则。 | 多 Agent 输出冲突。 | 定义 AggregationPolicy：first_valid、best_score、majority、human_arbitration。 |
| child output trust / taint 未明确传播。 | 子 Agent 污染父上下文。 | DelegationResult 必须携带 trust_level、taint_labels、evidence_refs。 |

### §20 长时任务与休眠

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 休眠恢复检查项正确，但未定义失败状态映射。 | resume 失败时状态混乱。 | version incompatible→recovery_needed；approval expired→awaiting_hitl；budget failed→paused_budget；secret failed→awaiting_operator。 |
| HibernationRecord 不在 MVP/Hardening 表集中。 | 长时任务能力无法实现。 | 若 MVP 支持 HITL wait，必须有 hibernation/timer 表；否则 MVP 声明不支持进程重启后长时等待。 |

### §21 HITL

| 问题 | 风险 | 改善方案 |
|---|---|---|
| HumanResponsibilityRecord 在 §45 出现，但 §21 没作为审批核心对象。 | 人工责任边界不稳定。 | §21.2 ApprovalFlow 每个 decision 必须生成 HumanResponsibilityRecord。 |
| 任一通过/并行会签规则缺风险限制。 | 高风险被一人通过。 | high/critical 默认 all-of 或 quorum；one-of 仅 low/medium 且可逆。 |
| 协同编辑 strict turn-taking 正确，但 artifact merge 策略未定义。 | patch 覆盖。 | 默认 token turn-taking；高级模式才允许 branch+merge/CRDT。 |

### §22 SDK 与开发者体验

| 问题 | 风险 | 改善方案 |
|---|---|---|
| SDK 示例容易绕过 HarnessRuntime。 | 业务 Pack 直接调 tool/model。 | SDK 只暴露 Harness API；ToolExecutor 只在 sandbox 内由 runtime 注入。 |
| Pack 本地 mock 测试可能与 runtime invariant 脱节。 | 本地通过、线上失败。 | Pack SDK 内置 invariant test harness：policy、budget、side-effect、replay、schema。 |

### §23 合规与数据治理

| 问题 | 风险 | 改善方案 |
|---|---|---|
| Crypto-shredding 与审计可读性冲突仍需更硬。 | 删除 PII 后审计链不可解释。 | 跨租户/审计记录保留 PII-free digest、hash、role、timestamp、legal basis；PII 字段单独加密。 |
| 数据保留策略没有和 Event/Audit 不可变性分层。 | 删除与审计冲突。 | 把 event payload 分为 immutable metadata + encrypted sensitive payload。 |

### §24 配置治理

| 问题 | 风险 | 改善方案 |
|---|---|---|
| emergency_override_config 可突破版本锁。 | 被滥用改变在途语义。 | 只允许收紧策略：deny、pause、egress block、sandbox harden；不得放松策略或切换到更危险工具。 |
| config.changed 热加载可能改变运行中 NodeRun。 | 破坏 replay。 | hot_reloadable 只能影响新 admission 或下一 checkpoint revalidation。 |

### §25 数据与状态一致性

| 问题 | 风险 | 改善方案 |
|---|---|---|
| L2 仍写 TaskRun/Step。 | legacy 状态模型残留。 | 改为 HarnessRun/NodeRun/Checkpoint。 |
| CAS + Lease + Fencing 每次状态转移写放大。 | 高并发图执行热点。 | runId 分区；scheduler tick 批量 transition；CAS 失败 requeue，不忙等。 |
| Projection lag 正常≤5s，但背压可 60s。 | 用户误信 stale projection。 | 所有 projection response 携带 freshness watermark；审批页禁止读 projection。 |
| VersionLock 默认 high/critical inherit_lock，但 emergency_override_config 可突破。 | 策略冲突。 | emergency override 只能收紧，不算版本锁 override。 |

### §26 存储架构

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 86 表 inventory 与 MVP 20 表仍差距大。 | 实施方不知先做哪个。 | 每张表必须有 `ring`、`owner`、`migration`、`rollback`、`golden test`。 |
| MVP 表缺 lease，Hardening 表重复 audit_record。 | MVP 不可执行。 | 修正 MVP 表集。 |
| BudgetLedger 在 §26.4 标 E2，但 §26.5 进 MVP。 | 迁移阶段矛盾。 | 若 MVP 有真实 LLM/tool 调用，BudgetLedger 必须 E1/MVP。 |
| ReconciliationRecord 在 E2，但 MVP 包含 SideEffect。 | 真实 side effect 无对账。 | MVP side effect 仅允许 simulated/reversible；真实外部写必须等 reconciliation 表上线。 |

### §27 性能架构与 SLO

| 问题 | 风险 | 改善方案 |
|---|---|---|
| OAPEFLIR 阶段性能目标不含 LLM，但用户会看 E2E。 | 体验争议。 | Dashboard 拆 InternalPlatformLatency / ProviderLatency / HumanWaitLatency / TotalE2E。 |
| Dispatch latency P99 <200ms 与 SQLite MVP 可能冲突。 | MVP 目标过高。 | MVP 定义 lower scale SLO；Enterprise 才承诺高并发 P99。 |

### §28 Event Registry / Projection / Incident / DLQ

| 问题 | 风险 | 改善方案 |
|---|---|---|
| platform.* 与 oapeflir.* 双命名仍复杂。 | projector 误用。 | `platform.*` 为唯一事实；`oapeflir.view.*` 为语义视图。 |
| EventEnvelope replayBehavior 未形成强制测试。 | Replay 时产生副作用。 | 每个事件类型必须声明 replay behavior：replay_as_fact / skip_side_effect / simulate / forbidden。 |
| Legacy event adapter 可能双计数。 | 指标和审计重复。 | adapter 事件必须标记 `derivedFromEventId`，projection 去重。 |

### §29 Knowledge / Memory / Artifact / Learning

| 问题 | 风险 | 改善方案 |
|---|---|---|
| Memory 6 层与 Working/Long-term/Shared 三层并存。 | 记忆模型不唯一。 | 定义 canonical：Working/Session/Episodic/Semantic/Procedural/Meta 是 MemoryNamespace 的子类型，或拆为两级模型。 |
| Knowledge trust 降级有待更具体。 | 错误 authoritative 知识继续影响。 | `authoritative → contested → under_review → retired/re-promoted`，并通知受影响 run/domain。 |
| Artifact 不承担 truth，但 artifact hash / immutability 未明确。 | 证据被替换。 | Artifact 必须 content-addressed、hash locked、WORM for audit evidence。 |
| LearningCandidate quarantine 已提，但污染测试矩阵不足。 | 错误学习上线。 | 加入 poisoning test、negative sampling、holdout conflict、PII/secret scan。 |

### §30 Business Pack

| 问题 | 风险 | 改善方案 |
|---|---|---|
| Pack 可以声明 ExecutionStrategy 覆盖默认值。 | Pack 反侵入平台底座。 | Pack 只能收紧策略；任何放松必须 P2 policy approval。 |
| Pack certification 与 Runtime invariant 测试未绑定。 | 认证只做安全扫描。 | Pack 发布必须跑 runtime contract tests。 |

### §31 容灾与高可用

| 问题 | 风险 | 改善方案 |
|---|---|---|
| HA-3 容易被读成多主。 | 与 §25/§52 single-leader 冲突。 | 明确 HA-3 是 multi-AZ single-leader + automatic failover，不是 multi-writer。 |
| DR 演练没有指定数据集和证据标准。 | 演练不可审计。 | DR drill 必须记录 RTO/RPO 实测、数据校验 hash、unreplicated writes、operator timeline。 |

### §32 部署架构

| 问题 | 风险 | 改善方案 |
|---|---|---|
| D1 单体与 P1-P5 平面概念容易误解。 | 团队过早拆微服务。 | 明确五平面是逻辑边界，Ring 1 必须模块化单体优先。 |
| Worker 分离后 secrets / sandbox / filesystem 边界未细化。 | Worker 泄露凭证或文件。 | Worker process 必须短租约 secret、workspace sandbox、egress allowlist。 |

### §37 业务域建模

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 12 问元模型本身无版本化。 | Q13/Q7 重构会导致 24 域迁移。 | 定义 `cdm_version`，支持 v1/v2 并存，迁移宽限期和 lint。 |
| DomainRiskProfile 可放松平台默认风险。 | 域 owner 可能降低安全。 | 放松必须 platform security approval + explicit audit reason + expiry。 |
| conflict_strategy 枚举/插件边界需更硬。 | 任意字符串无法执行。 | 只允许闭合枚举；自定义需要 ConflictResolver 插件和测试。 |

### §38 业务域接入 Runbook

| 问题 | 风险 | 改善方案 |
|---|---|---|
| Gate 1-4 人工清单多，但机器验收少。 | 文档化通过，系统不保证。 | 每个 Gate 输出 machine-readable certification record。 |
| 覆盖率 ≥80% 太笼统。 | 关键路径可能无测试。 | 按 test type 分：unit、contract、integration、eval、security、replay、side-effect simulation。 |

### §71-§94 垂直域

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 24 域内容大量模板化，主文档过重。 | 核心架构维护困难。 | 拆到 `domain-specs/`；主文档只保留 2-3 个示例域。 |
| 各域风险数字缺统一校准。 | 同一阈值跨域失效。 | 使用 §10 风险校准表重新标注。 |
| Critical 域的 HITL 100% 只写原则。 | 无法证明实际覆盖。 | domain lint 检查每个 critical action 是否绑定 HITL + responsibility record。 |

### §39 自然语言任务入口

| 问题 | 风险 | 改善方案 |
|---|---|---|
| “所有 NL 最终转 RequestEnvelope”缺中间确认态。 | 误执行。 | 改为 TaskDraft / Clarification / ConfirmedTaskSpec / RequestEnvelope。 |
| 歧义消解对低风险可能可跳过，但规则未定义。 | 过度追问或误执行。 | `ambiguity_policy` 按 risk 分级：low 可默认、medium 需确认、high+ 必须显式确认。 |

### §40 目标分解

| 问题 | 风险 | 改善方案 |
|---|---|---|
| GoalDecomposer 与 PlanGraph Planner 边界可能重叠。 | 双重规划。 | GoalDecomposer 输出 TaskGraph，Planner 输出 PlanGraph；TaskGraph 不可直接执行。 |
| DAG 校验正确，但 cycle/loop 需求未建模。 | 复杂业务循环被错误拒绝或绕过。 | 使用 LoopNode 显式建模受控循环。 |

### §41 主动式 Agent

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 触发器与用户任务共享预算。 | Proactive 耗尽预算。 | 预算分池：user_reserved_min_pct 默认 60%，trigger 预算耗尽降级 silent-record。 |
| 触发风暴只按次数/频率，不按成本。 | 少量高成本触发耗尽资源。 | TriggerDefinition 加 max_cost_per_day / max_cost_per_fire。 |

### §42 渐进式自主权

| 问题 | 风险 | 改善方案 |
|---|---|---|
| TrustScore 衰减已有防博弈，但生产假任务识别仍需具体信号。 | 保活任务刷信任。 | 信任分只统计 verified user task / evaluated task；synthetic task 只能进入 eval score。 |
| 自主权变更和 AgentVersion 快照关系需强化。 | 当前版本行为变化不可追踪。 | 每次 autonomy level 变化生成 AgentRuntimeProfileVersion。 |

### §43 统一运营看板

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 看板摘要可由 LLM 生成，可能幻觉运营状态。 | 用户误判事故。 | NL summary 必须引用 metrics/evidence refs；禁止生成无依据结论。 |
| 成本金额示例使用 ¥。 | 多 region 多币种不一致。 | UI 按 tenant currency / reporting currency 双展示。 |

### §44 非技术用户体验

| 问题 | 风险 | 改善方案 |
|---|---|---|
| “风险滑块”对高风险域危险。 | 非技术用户降低策略。 | UI 只能收紧；放松进入 P2 approval。 |
| 单人模式自审批仍需补偿控制。 | 无独立监督。 | 强制 dry-run、cooldown、limit cap、undo/compensation window、审计提醒。 |

### §45 Harness Runtime

| 问题 | 风险 | 改善方案 |
|---|---|---|
| HarnessStep 仍有 `stepId`。 | 与 NodeRun 混淆。 | HarnessStep 用 `harnessStepId`，NodeRun 用 `nodeRunId`。 |
| LoopController 可 downgrade_mode，但 mode scope/priority 在 §45 未引用。 | 降级行为不一致。 | HarnessDecision.downgrade_mode 必须包含 target_scope、duration、reason、recovery_condition。 |
| HITL Runtime 与 ApprovalFlow 分散。 | 人工介入模型双轨。 | HITL Runtime 是运行时 primitive；ApprovalFlow 是 HITL 的一种 resolution provider。 |
| ContextAssembler 的 eviction policy 未足够具体。 | 关键上下文被截断。 | 定义层级优先级：current instruction / constraints / safety / active plan 不可驱逐；episodic 可摘要；retrieved docs 可裁剪。 |

### §58 Harness 横切关注面

| 问题 | 风险 | 改善方案 |
|---|---|---|
| Harness metrics 默认 P99 <60s 可能与长时任务冲突。 | 指标常态报警。 | 按 run type 分：sync_interactive、async_long_running、hibernated；长时任务看 active execution time 与 wait time。 |
| Replay / Simulation 缺 side-effect shadow boundary 字段。 | 模拟误触真实系统。 | ReplaySession 必须有 `sideEffectMode=disabled/simulated/mock_only`，默认 disabled。 |
| Failure-to-Learning 管线仍需对抗污染测试。 | 错误反馈被学习。 | 引入 feedback trust、quarantine、holdout eval、negative sampling。 |

### §46-§51 组织治理

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 组织变更可能影响 in-flight approval route。 | 审批人变更导致责任争议。 | ApprovalRouteSnapshot 在 request 时冻结；组织变更只影响新审批，除非安全撤销。 |
| Peer 委托利益冲突检查不足。 | SoD 被形式绕过。 | Peer delegate 必须过 conflict-of-interest filter。 |
| Chinese Wall 缺 expiry/解除机制。 | 用户长期无法工作。 | WallExpiry 需合规官审批、时间触发、完整审计。 |
| Governance delegation 和 non-overridable invariant 边界需更清晰。 | 管理员越权。 | 委托不能覆盖 RuntimeInvariant、SecurityInvariant、AuditInvariant。 |

### §52 Multi-Region

| 问题 | 风险 | 改善方案 |
|---|---|---|
| single-leader per partition 已正确，但 failover 数据差异处理需更细。 | 未复制 leader writes 丢失或重复。 | Failover 必须生成 `FailoverReconciliationJob`，列出 unreplicated writes、budget reservations、side effects。 |
| 跨境 LLM 输出 PII 风险。 | 合规违规。 | 跨境调用 response scan，命中 PII 时隔离、清洗、上报。 |

### §53 资源竞争

| 问题 | 风险 | 改善方案 |
|---|---|---|
| starvation prevention 自动升级仍可能造成 priority inflation。 | 高负载下全部变 high。 | 使用 aging weight 而非离散升级；每租户升级率上限；超过阈值触发容量告警。 |
| preemption 对 side-effect node 不安全。 | 中断外部操作。 | 仅可抢占未开始或可 checkpoint 的 node；committing side effect 不可抢占。 |

### §54 SLA

| 问题 | 风险 | 改善方案 |
|---|---|---|
| SLA tier 同时有 E2E P95 和 Internal P99，方向正确但需默认值。 | Domain 未配置时无标准。 | 定义 platform default：interactive P95/P99、async queue、human wait excluded/included 口径。 |

### §55 Marketplace

| 问题 | 风险 | 改善方案 |
|---|---|---|
| removed 状态对活跃安装迁移保障不足。 | 关键 workflow 中断。 | 活跃安装 >N 的项目不得 removed，除非 ≥80% 迁移或 security emergency。 |
| 第三方 Pack certification 未绑定 runtime invariant tests。 | 恶意/不兼容 Pack 上架。 | 上架必须跑 sandbox、contract、policy、budget、side-effect simulation tests。 |

### §56 反馈驱动持续改进

| 问题 | 风险 | 改善方案 |
|---|---|---|
| Few-shot harvesting 容易偏置。 | 单团队反馈污染 Prompt。 | 多样性/覆盖度评分；低覆盖必须人工审核。 |
| 自动改进类型中 Model routing 全自动可能影响合规。 | 数据驻留或 judge 独立性被破坏。 | Routing 自动优化不得改变 data_residency / security / judge independence。 |

### §57 外部系统集成

| 问题 | 风险 | 改善方案 |
|---|---|---|
| Connector action schema / idempotency requirements 不够硬。 | 外部写重复。 | 每个 write action 必须声明 idempotency_key、confirmation_method、reconciliation_method、compensation_capability。 |
| MCP/Browser/DB/File 协议风险不同。 | 统一 connector 抽象过粗。 | ConnectorCapabilityProfile 细分 read/write/stream/browser/db/file，绑定 sandbox tier。 |

### §59 可解释性

| 问题 | 风险 | 改善方案 |
|---|---|---|
| ExplanationRenderer 可能用 LLM 生成解释。 | 解释幻觉。 | 解释必须 evidence-grounded；LLM 只能改写，不得新增事实；每句话可追 evidence ref。 |
| L3 forensic 不缓存正确，但成本高。 | 审计高峰成本失控。 | forensic 报告使用模板化渲染优先，LLM 可选。 |

### §60 Panic

| 问题 | 风险 | 改善方案 |
|---|---|---|
| Panic ack 已增强，但部分平面未确认的基础设施强杀需更明确。 | 被入侵平面不响应。 | 未 ack 超时进入 `panic_incomplete`，自动隔离网络、撤销 token、kill worker/process。 |
| Resume 需要双人审批正确，但恢复顺序需绑定 evidence。 | 威胁未清除即恢复。 | ResumeDirective 必须引用 ForensicSnapshot review 和 threat-cleared evidence。 |

### §61 Agent 生命周期

| 问题 | 风险 | 改善方案 |
|---|---|---|
| testing/staging 回退路径需要保留谱系。 | 失败版本难追踪。 | 状态机增加 testing→draft、staging→draft，但 versionId 不变，保留 audit。 |
| AgentVersion 与 TrustProfile 动态变化关系需固化。 | active 版本行为漂移。 | TrustProfile 是 runtime profile version，变化产生 AgentRuntimeProfileVersion。 |

### §62 Edge Runtime

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 被盗/离线设备安全模型不足。 | Edge 伪造 side effect。 | 设备身份、硬件绑定、secure storage、remote wipe、offline signing key expiry。 |
| SyncQueue side effect 依赖需要更硬。 | 根操作失败，后续仍提交。 | side effects 携带 dependency graph；拓扑提交；首次冲突中止下游。 |

### §63 漂移检测

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 高级算法初期过重。 | MVP 实施成本高。 | MVP 仅阈值 + baseline diff；Enterprise 再引入 CUSUM/BOCPD。 |
| Drift 降级会影响生产业务。 | 误报频繁降级。 | medium drift 先 alert + increased sampling；high 才 pause。 |

### §64 成本优化

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 优化建议可能降低安全质量。 | 成本优化绕过高质量模型。 | cost optimizer 只能建议，不得自动放松 model_independence、data_residency、safety guardrails。 |

### §65 调试器

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 断点调试运行中 workflow 风险高。 | 调试操作改变生产语义。 | 生产断点只允许 HITL pause/inspect；step_over/time-travel 只能在 replay sandbox。 |

### §66 合规报告

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 报告自动生成依赖证据完整性，但 evidence coverage 未定义。 | 自动报告看似完整但缺证据。 | 每个 control 有 EvidenceRequirement，缺失标 partial/fail，不允许自动 pass。 |

### §67 容量规划

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 容量预测没有反馈到 admission control。 | 预测只看不用。 | CapacityAlert 可触发 admission throttling、pre-scale proposal、budget warning。 |

### §68 多模态

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 多模态没有完全进入 Guardrails / Artifact / Eval / Cost。 | 图片、音频、文档绕过文本护栏。 | 每种 modality 都有 safety scan、artifact hash、cost unit、eval metric、redaction pipeline。 |

### §69 PlatformOps Agent

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 平台故障时 PlatformOps 可能同故障域失效。 | 自运维失效。 | 外部 break-glass ops path：独立监控、独立凭证、只读 emergency dashboard。 |
| 自运维写操作必须人工审批正确，但 runbook 执行边界需更硬。 | 自动修复扩大事故。 | PlatformOps 写操作爆炸半径默认单节点/单服务，超过需 CAB/HITL。 |

### §33 路线图

| 问题 | 风险 | 改善方案 |
|---|---|---|
| Ring 与 Phase 历史映射仍太复杂。 | 排期争论。 | 主路线只保留三环；Phase 1-9 放迁移附录。 |
| MVP 仍包含 HITL basic、Trace Replay、SideEffectManager，但缺对应表和 API 完整闭合。 | MVP 做不出。 | MVP acceptance test 反推最小表/API/事件。 |
| Phase 9 域 GA 不应是平台内核里程碑。 | 最慢域阻塞平台。 | 平台里程碑按 N/24 domain specs lint pass、K domain pilots GA。 |

### §34 ADR

| 问题 | 风险 | 改善方案 |
|---|---|---|
| ADR 数量巨大。 | 冻结负担过重。 | ADR 分 ring 冻结：MVP ADR 必须冻结；Enterprise ADR 可 proposed。 |
| ADR 与正文重复。 | 改一处漏一处。 | ADR 只记录决策、备选方案、后果；正文只引用 ADR ID。 |

### §35 推荐代码目录

| 问题 | 风险 | 改善方案 |
|---|---|---|
| OAPEFLIR 双路径虽标 deprecated，但仍列出。 | 新代码误放旧目录。 | deprecated path 不在推荐目录正文，只放迁移附录。 |
| state-evidence/runtime/harness 目录边界仍重叠。 | 状态机实现分散。 | `runtime-state-machine/` 作为唯一 truth transition 模块；P5 repo 只做 persistence。 |

### §36 风险、约束与成功标准

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 风险列表太长但未排序。 | 真正高风险被淹没。 | 风险矩阵：impact × likelihood × detectability，绑定 owner 和 mitigation。 |
| 硬约束混合 runtime invariant 和业务流程策略。 | 测试和治理混乱。 | 拆成 Machine-Enforced Invariants、Policy-Enforced Rules、Process-Enforced Obligations。 |
| 成功标准有“覆盖率 ≥80%”但缺关键路径测试。 | 覆盖率虚高。 | 增加 Contract / State-machine / Replay / Chaos / Security / Side-effect / Budget concurrency tests。 |

### §70 结论与附录

| 问题 | 风险 | 改善方案 |
|---|---|---|
| 附录 H 与正文冲突解决规则过复杂。 | 冲突时不可执行。 | 只保留一条：Machine Contract/Schema/Event Registry 决定运行时；Core Architecture 决定意图；冲突必须修文档。 |
| 版本历史太长。 | 主文档噪音。 | 只保留最近 3 个版本，完整历史移 `CHANGELOG.md`。 |

---

## 3. v4.3 应该冻结的最小可执行契约

v4.3 不应继续扩展能力，应冻结以下 12 个契约：

1. `TaskDraft / ConfirmedTaskSpec / RequestEnvelope`
2. `HarnessRun`
3. `PlanGraphBundle / PlanGraph / PlanNode / PlanEdge`
4. `GraphPatch / GraphPatchOperation`
5. `NodeRun / NodeAttempt / AttemptLineage`
6. `NodeAttemptReceipt`
7. `SideEffectRecord / ReconciliationRecord / CompensationRecord`
8. `BudgetLedger / BudgetReservation / BudgetSettlement`
9. `RunVersionLock / ArtifactVersionLockSet`
10. `DecisionInputBundle / HarnessDecision`
11. `HumanResponsibilityRecord`
12. `EventEnvelope / PlatformFactEvent / OapeflirViewEvent`

每个契约必须具备：Zod/JSON Schema、状态机、事件清单、Repository API、contract test、replay behavior、failure behavior。

---

## 4. v4.3 MVP 表集建议

当前 MVP 表集建议修正为 22 张以内：

| 类别 | 表 |
|---|---|
| Identity / Tenant | tenant, principal |
| Intake | task_draft, confirmed_task_spec, idempotency_record |
| Runtime Truth | harness_run, plan_graph, graph_patch, node_run, node_attempt, lease_record |
| Budget | budget_ledger, budget_reservation |
| Side Effect | side_effect |
| Decision / HITL | approval_request, decision_record, human_responsibility_record |
| Evidence | event_log, event_outbox, event_inbox, checkpoint, artifact_record, audit_record |
| Tooling | tool_definition, tool_call |

若必须严格 ≤20 张，可合并：`task_draft + confirmed_task_spec`、`event_inbox + event_outbox`、`approval_request + decision_record`，但不建议删除 `lease_record`。

---

## 5. v4.3 必须补齐的测试矩阵

| 测试类型 | 必测内容 | 阻断级别 |
|---|---|---|
| Contract Test | 所有 Runtime contract schema 向后兼容 | CI blocker |
| State-machine Test | HarnessRun / NodeRun / SideEffect / Budget 所有合法/非法转移 | CI blocker |
| Event Consumer Test | truth projector 只消费 platform facts，不消费 oapeflir view events | CI blocker |
| Replay Test | Trace Replay 不调用 LLM、Tool、真实 side effect | CI blocker |
| Budget Concurrency Test | 1000 并发 reserve 不穿透 hard cap | CI blocker |
| SideEffect Ambiguity Test | timeout/unknown receipt 不得视为 success | CI blocker |
| GraphPatch Test | 已执行节点不可删除；副作用影响必须声明 | CI blocker |
| HITL Responsibility Test | approve/override/takeover/resume 都生成责任记录 | CI blocker |
| Prompt/LLM Safety Test | Injection、PII/secret scan、schema validation、judge independence | release blocker |
| Outbox/Inbox Chaos Test | poller crash、duplicate delivery、consumer retry、DLQ redrive | release blocker |
| Multi-region Failover Test | fencing epoch、old leader demotion、unreplicated write reconciliation | enterprise blocker |
| Domain Lint Test | risk/HITL/eval/tool/data boundary 覆盖率 | domain onboarding blocker |

---

## 6. 最终建议

这版架构已经过了“方向审查”，下一步不是继续扩写章节，而是进入“规格冻结”。冻结顺序建议：

1. **先冻结运行时对象和状态机**：HarnessRun、NodeRun、GraphPatch、SideEffect、Budget。
2. **再冻结事件和证据**：platform facts、oapeflir view events、replay behavior、projection consumer 规则。
3. **再冻结 MVP 表集和 API**：确保 8-12 周可真实交付。
4. **最后拆分主文档**：把 24 域、ADR、附录、历史版本移出主文档。

如果 v4.3 能完成以上冻结，这套架构就可以从 Release Candidate 进入真正可开工、可测试、可长期演进的生产规格。
