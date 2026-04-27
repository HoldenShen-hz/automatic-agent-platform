# 企业级 Agent 平台总体架构 v4.1 — 逐节深度 Review 与改善方案

> **审查对象**：`粘贴的 markdown (1)。md`  
> **识别版本**：v4.1 Release Candidate  
> **审查方式**：逐节阅读正文结构，重点检查架构权威性、一致性、状态机闭合度、生产可靠性、路线图可落地性、文档可维护性。  
> **审查结论**：v4.1 相比上一版已经明显收敛，很多关键整改已经进入正文；但仍存在“版本权威混乱、契约命名遗留、运行时协议未完全产品化、SLO/Phase/Domain 交叉不一致、过度工程与 MVP 边界不稳”等问题。下一版不宜继续扩功能，应进入 **v4.2 收敛版 / 可实现规格版**。

---

## 0. 总体判断

### 0.1 已明显改善的部分

v4.1 已经吸收了上一轮很多关键修复：

| 已改善项 | 当前状态 |
|---|---|
| OAPEFLIR / Harness 双模型冲突 | 已明确 HarnessRun 是唯一权威 Run，OAPEFLIR 仅作为 StageRationale / TraceProjection / Audit View |
| Plan 线性 steps 问题 | 已引入 PlanGraphBundle、NodeRun、Graph Scheduler |
| Budget TOCTOU | 已引入 atomic reserve / settle / release |
| Replay 不确定性 | 已区分 Trace Replay 与 Re-execution Replay |
| SideEffect 两阶段过粗 | 已升级为 proposed / approved / committing / confirmed / revoked / expired / ambiguous / reconciling |
| Panic TTL 自动解除风险 | 已改为 reconfirmation，不自动解除 |
| TrustScore 降低 risk | 已明确 TrustScore 只影响 automation_mode 与复核摩擦，不降低 inherent_risk |
| Multi-Region active-active 写入风险 | 已改为 single-leader per partition，active-active 仅用于非 truth 数据 |
| 超低延迟域与 LLM 热路径冲突 | 已在 DomainDescriptor 增加 deterministic hot path 模式 |

这些修正是方向正确的，说明 v4.1 已经从“宏大蓝图”往“生产语义闭合”推进。

---

### 0.2 v4.1 仍然最危险的 12 个问题

| 编号 | 问题 | 严重性 | 说明 |
|---|---|---:|---|
| R1 | v4.1 正文与 v4.4 Executable Spec 同时作为权威来源 | Critical | 附录 H 声称 v4.4 spec 是运行契约输入来源，但正文版本是 v4.1，容易形成双权威 |
| R2 | `ExecutionPlan` 名称仍保留，PlanGraph 权威性仍可能被实现误读 | High | 文中多处写 `ExecutionPlan / PlanGraphBundle`，代码实现可能继续保留 steps 兼容层 |
| R3 | `ControlDirective` 虽拆分为 Operational/Decision，但矩阵、拓扑、模式切换仍使用旧名 | High | 文档语义未完全收敛，容易导致权限模型继续混用 |
| R4 | Phase 8a/8b/8c/8d 与 Phase 1-7、三环路线仍然复杂 | High | “8c 须在 Phase 5 前完成”与 Phase 顺序读法冲突，执行排期会混乱 |
| R5 | API 层未暴露 PlanGraph / NodeRun / SideEffect / BudgetReservation / Replay 等核心运行对象 | High | 用户和运维无法通过 API 操作关键生产实体 |
| R6 | Outbox Poller 仍缺 lease TTL、热备、投递间隙 SLO | High | Projection lag ≤5s 与 poller 崩溃恢复无法严格保证 |
| R7 | Webhook 仍只有“失败 >50 次禁用”，没有 retry policy 细则 | Medium | 429、4xx、5xx、timeout、signature mismatch 应有不同处理 |
| R8 | `Prompt 缓存` 仍写“语义相似请求复用”，但没有 embedding 相似阈值、误命中隔离和安全规则 | Medium | 可能把语义缓存当作确定性缓存使用 |
| R9 | TrustScore 90d 仍有断崖降级 | Medium | 虽然风险降权已修，但信任衰减仍可能被博弈或造成生产突变 |
| R10 | SLA 模型字段是 P99，但矩阵列仍写 P95 | Medium | 度量口径不一致 |
| R11 | 86 张逻辑表仍进入主线架构，MVP 表集和 Phase 表集不够硬 | Medium | 存储实现会过早膨胀 |
| R12 | 24 个垂直域仍占据主文档大量篇幅 | Medium | 主架构文档可读性和维护性下降，域规范应该拆分 |

---

## 1. 前言、目录与全书骨架

### 1.1 问题

1. **版本权威混乱**：正文是 v4.1 Release Candidate，但附录 H 引入 OAPEFLIR v4.4 Executable Spec，且说“完整规范以 v4.4 spec 为运行契约输入来源”。这会让实现团队不知道应以 v4.1 正文、v4.4 spec、还是附录 H 为准。
2. **Phase 图仍然复杂**：全书骨架中 Phase 8a/8d 与 Phase 1-3 并行、Phase 8c 还要求在 Phase 5 前完成，但正文 §33 又把 Phase 8a-8d 单独展开。这种“Phase + Ring + Slice”三套排期模型没有完全收敛。
3. **文档体量仍然过大**：9000+ 行包含核心架构、24 域、路线图、ADR、目录结构、附录规范，主文档已接近“架构百科”，不利于工程执行。

### 1.2 改善方案

- 把版本权威改为：

```text
v4.2 Core Architecture = 当前主文档唯一权威
v4.2 Executable Spec = 从 Core Architecture 自动/手工派生的运行契约
v4.1 / v4.4 = 历史输入，不再作为直接实现依据
```

- 在首页增加“权威源优先级”：

```text
1. Executable Runtime Contract
2. Schema / Zod / OpenAPI / Event Registry
3. Core Architecture
4. ADR
5. Domain Spec
6. Example / Appendix
```

- Phase 图简化为：

```text
Ring 1: MVP Slice
Ring 2: Hardening
Ring 3: Scale & Domains
```

Phase 8a-8d 不再作为独立路线，而是拆入 Ring 1/2 的交付包。

---

# 2. §1 文档概述

### 2.1 问题

1. “Release Candidate”合理，但文档仍包含大量未来形态能力，例如 Marketplace、Edge、PlatformOps、24 域完整深化、IDE Debugger。
2. 文档目标覆盖过广，容易让团队误以为 v4.1 就是一次性实施边界。
3. 非目标虽然有，但没有和 Phase/MVP 强绑定。

### 2.2 改善方案

在 §1 增加“实现边界声明”：

```text
本文件包含完整目标态，但 v4.2 的实现边界以 §33 Ring 1 / MVP Slice 为准。
未进入 MVP Slice 的章节只作为兼容性设计，不得阻塞核心闭环交付。
```

增加每节成熟度标签：

```text
[MVP] [Hardening] [Enterprise] [Future]
```

---

# 3. §2 平台根假设与设计目标

### 3.1 问题

1. “默认不可信 / 默认会失败 / 默认收敛”等宪法正确，但仍偏原则陈述。
2. 八个硬目标没有逐项绑定可执行 invariant、测试、指标和对应模块。
3. “状态与证据同等重要”已经提出，但 Evidence 的强制写入边界只在后文分散出现。

### 3.2 改善方案

增加 `ArchitectureInvariantRegistry`：

```yaml
id: INV-STATE-001
statement: 每次 HarnessRun/NodeRun truth mutation 必须同事务追加 event
enforcement_point: StateStore.UnitOfWork
test_ref: tests/state/truth-event-atomicity.test.ts
failure_behavior: reject mutation and emit incident
phase: MVP
```

每个设计宪法至少对应 3-5 个可执行 invariant。

---

# 4. §3 平台定义与非目标

### 4.1 问题

1. “不是什么”仍然偏抽象，没有将医疗、法律、金融、交易等高风险域的责任边界上升为全局声明。
2. 对“辅助决策”和“自动执行”的边界还不够硬。
3. 对“超低延迟/确定性系统”已经在后文修复，但 §3 非目标没有同步强调。

### 4.2 改善方案

增加全局非目标：

```text
平台不是医疗诊断主体、法律意见主体、金融最终授信主体、证券交易热路径执行引擎。
平台可以辅助生成建议、证据、计划、候选动作；高风险域最终责任由具备法定资质或组织授权的人/系统承担。
```

---

# Part I — 基础设施层

---

# 5. §4 总体架构：五平面 + 一横切控制织网

### 5.1 问题

1. P3 仍然承载过多：OAPEFLIR、workflow orchestration、planning、replanning、PlanGraph builder、scheduler policy、routing、escalation 都在 P3，容易成为“万能平面”。
2. P5 仍然把 Truth、Events、Projections、Artifacts、Audit 放在一个平面里，虽然逻辑上可以，但实现上生命周期和一致性差异很大。
3. X1 作为横切 Fabric 的服务边界不清：哪些是库/中间件，哪些是独立服务，哪些是策略注入点，仍需要实现层规范。

### 5.2 改善方案

- P3 内部强制分层：

```text
P3a HarnessRuntime
P3b Planning Services
P3c Evaluation Services
P3d Routing/Escalation Services
```

- P5 内部强制分库/分模块：

```text
P5a truth-store
P5b event-store
P5c projection-store
P5d artifact-store
P5e audit-store
```

- X1 定义三种落地形态：

```text
library middleware
sidecar / interceptor
central service
```

每个横切能力必须标注形态，避免全部做成独立服务。

---

# 6. §5 平面间通信契约

### 6.1 问题

1. `ControlDirective` 虽然在 §5.3 被拆为 `OperationalDirective` 与 `DecisionDirective`，但 §5.2 契约矩阵、§7 拓扑、§9 模式切换、§14 运行模式仍使用 `ControlDirective` 泛称。
2. `ExecutionPlan` 仍保留为契约名称，只是“内部结构升级为 PlanGraphBundle”。这会保留旧 steps 实现的借口。
3. `StateCommand` 仍然太宽，虽然列了 `mutation_type`，但 truth mutation、event append、audit append、artifact write 的事务语义不同。
4. 缺少标准 envelope 字段清单，例如 `schemaVersion`、`idempotencyKey`、`causationId`、`signature`、`expiresAt` 是否所有契约都必须有。

### 6.2 改善方案

- 废弃 `ExecutionPlan` 名称：

```text
ExecutionPlan = deprecated alias
Canonical contract = PlanGraphBundle
```

- 契约矩阵改为：

```text
P2 → P3/P4: OperationalDirective
HITL/Approval → P3/P4: DecisionDirective
P3 → P4: PlanGraphDispatch
P4 → P5: StateMutationCommand
P4/P5 → EventLog: EventAppendCommand
P4/P5 → Audit: AuditAppendCommand
```

- 所有平面间命令统一 envelope：

```yaml
schemaVersion:
commandId:
tenantId:
runId:
traceId:
correlationId:
causationId:
issuedBy:
issuedAt:
expiresAt:
idempotencyKey:
signature:
```

---

# 7. §6 API 契约与版本化架构

### 7.1 问题

1. API 资源缺少核心生产实体：PlanGraph、NodeRun、SideEffectRecord、BudgetReservation、ReplaySession、ForensicSnapshot、PanicDirective、HarnessDecision。
2. `/workflow-runs/{id}/steps` 仍然沿用 step 视角，没有体现 NodeRun / PlanGraph 节点。
3. Webhook 仍没有 retry policy 细则，只写失败 >50 次禁用。
4. 错误响应结构没有展开，缺少 error code、retryable、severity、user_action、trace_id。
5. API Key 长期有效但只说“支持手动轮换”，缺少到期、作用域、最后使用时间和异常吊销策略。

### 7.2 改善方案

新增 API：

```text
GET /api/v1/harness-runs/{id}/plan-graph
GET /api/v1/harness-runs/{id}/node-runs
GET /api/v1/harness-runs/{id}/side-effects
GET /api/v1/harness-runs/{id}/budget-reservations
POST /api/v1/replay-sessions
GET /api/v1/replay-sessions/{id}
POST /api/v1/admin/panic-directives
POST /api/v1/admin/resume-directives
```

Webhook retry policy：

```text
429: respect Retry-After
5xx/timeout: exponential backoff, max 15min, jitter
4xx permanent: disable after 10
signature mismatch: disable immediately
```

统一错误响应：

```json
{
  "error_code": "PLATFORM.P4.TOOL.TIMEOUT",
  "message": "...",
  "retryable": true,
  "severity": "warning|error|critical",
  "user_action": "...",
  "trace_id": "..."
}
```

---

# 8. §7 服务通信架构

### 8.1 问题

1. Outbox Poller 仍只有“lease 单实例”，没有 lease TTL、heartbeat、热备、最大投递间隙。
2. Projection lag 在 §25/§27 设为 ≤5s，但 §7 没有保证 poller failover 后仍能满足。
3. 流式推送只说 last_event_id 恢复，没有定义事件保留窗口、gap 检测、snapshot+delta 恢复。
4. 进程内到微服务的演进路径合理，但没有定义跨进程时的幂等、重试和事务边界变化。

### 8.2 改善方案

增加：

```yaml
outbox_poller:
  lease_ttl_seconds: 10
  heartbeat_interval_seconds: 3
  standby_pollers: 1
  max_delivery_gap_p99_seconds: 10
  max_batch_size: 500
```

流式恢复：

```text
last_event_id within 24h → delta replay
last_event_id expired → snapshot + delta
gap detected → client receives stream_gap event and must resync
```

---

# 9. §8 可扩展性架构

### 9.1 问题

1. S1-S4 扩展阶段只有概念，没有容量门槛、资源模型和负载画像。
2. S4 目标和 §33 Phase 6 的 1000 并发之间仍然缺少中间层压测。
3. 分片策略未定义迁移、再均衡、热租户拆分。
4. Worker 无状态化与 Browser Session、Long-running Tool、EdgeRuntime 等状态性执行存在冲突。

### 9.2 改善方案

增加容量档：

```text
S1 10 concurrent workflows
S2 50
S3a 200
S3b 500
S4 1000+
```

增加 `ShardRebalanceProtocol`：

```text
detect hot partition → create split plan → shadow route → dual read compare → cutover → cleanup
```

状态性 worker 必须声明：

```yaml
stateful: true
lease_migration_supported: false
checkpoint_required_before_preempt: true
```

---

# 10. §9 稳定性架构

### 10.1 问题

1. tenant failure rate >30% 自动隔离，没有最小样本数，低流量租户可能被 1-2 次失败误伤。
2. 降级模式自动切换没有 cooldown、解除条件和震荡抑制。
3. `manual_only` 被 approval backlog >100 触发，但 backlog 数应按审批容量、租户数、SLA tier 加权，不应固定全局阈值。
4. 模式之间没有明确优先级，例如 no-write 与 no-external-call 同时触发时如何合成。

### 10.2 改善方案

增加：

```text
min_sample_size
cooldown_window
stable_recovery_window
mode_priority = incident-mode > manual_only > no-write > no-external-call > read_only > supervised_auto > full_auto
```

backlog 触发条件改为：

```text
approval_backlog / approval_processing_capacity > threshold
```

---

# 11. §10 风险控制架构

### 11.1 问题

1. `risk_score = Σ(weight × value)` 仍缺少跨域校准方法，DomainRiskProfile 可能继续产生不可比风险分。
2. `automation_mode = f(trust_score, domain_cap, policy)` 已避免降低 inherent risk，但仍需说明 trust 对什么阈值产生影响。
3. 风险模型没有把“可逆性、外部副作用、数据敏感度、法律责任主体”单独作为一等因子。
4. 风险得分和审批路由、SideEffect 状态机、Budget hard cap 的联动还不够显式。

### 11.2 改善方案

风险因子固定为：

```text
impact
irreversibility
external_side_effect
data_sensitivity
regulatory_exposure
financial_exposure
operator_scope
model_uncertainty
```

Trust 只允许影响：

```text
low-risk confirmation frequency
queue priority within same risk tier
post-execution sampling rate
```

不得影响：

```text
approval required threshold
sandbox level
egress policy
budget hard cap
irreversible side-effect confirmation
```

---

# 12. §11 安全可靠架构

### 12.1 问题

1. Sandbox tier 和 secret TTL 有定义，但缺少 sandbox escape test、egress deny-by-default 测试和供应链安全基线。
2. 插件安全治理仍偏原则，缺少签名、SBOM、依赖扫描、运行时最小权限。
3. Prompt injection 防御如果依赖分类器，需要训练数据、误报率、漏报率、更新流程；否则应降级为规则+隔离的工程防线。
4. Secret 续租流程未完全定义：长任务如何续租、失败如何回收、checkpoint 如何避免泄露。

### 12.2 改善方案

新增安全基线：

```text
plugin signing
SBOM required
dependency vulnerability scan
sandbox egress allowlist
secret lease renewal protocol
prompt-injection-to-tool-call attack simulation
```

Secret 规则：

```text
checkpoint never stores secret value
resume must request new secret lease
secret lease renewal requires active run + policy recheck
```

---

# 13. §12 异常事件处理架构

### 13.1 问题

1. E1-E6 分类有价值，但与统一错误码、Incident state、DLQ state 的映射还不够硬。
2. SEV 与稳定性 mode switching 的关系分散在 §9/§12/§60。
3. DLQ 运营缺少 ownership、SLA、discard policy、重放安全规则。
4. 告警路由没有 dedupe、suppression、maintenance window、escalation cooldown。

### 13.2 改善方案

增加：

```text
IncidentState = detected → triaged → mitigating → resolved → reviewed → closed
DLQState = recorded → claimed → replaying → resolved | discarded | escalated
```

每个异常类绑定：

```text
error_code_namespace
incident_severity
mode_switch_rule
owner_team
replay_allowed
```

---

# 14. §13 OAPEFLIR 受控认知框架

### 14.1 问题

1. 当前已明确 OAPEFLIR 不创建独立运行实体，这是正确的；但 §13 仍然有大量“阶段主链”描述，容易被实现成另一个状态机。
2. OAPEFLIR 的 Observe/Assess/Plan/Execute/Feedback/Learn/Improve/Release 与 Harness Planner/Generator/Evaluator/Feedback 有重叠，需要更强的“投影字段”定义。
3. Learn/Improve/Release 与 §56 反馈改进、§16 Prompt rollout、§17 Eval gate、§34 ADR 仍有流程重叠。
4. OAPEFLIR TraceProjection 的 schema 仍需明确，不能只描述语义。

### 14.2 改善方案

将 OAPEFLIR 定义为只产出以下投影对象：

```text
StageRationale
AssessmentSummary
PlanRationale
FeedbackSummary
LearningCandidate
ImprovementProposal
ReleaseDecisionView
```

禁止 OAPEFLIR 拥有：

```text
run status
step status
lease
retry counter
side effect commit state
budget state
```

Learn/Improve/Release 归口：

```text
Learn = candidate generation
Improve = proposal preparation
Release = P2 Release Governance decision
```

---

# 15. §14 Runtime Execution Plane

### 15.1 问题

1. NodeRun 状态机已经补齐，但 `HarnessStep` 与 `NodeRun` 的边界仍需更清楚：一个语义 step 是否可以展开成多个 NodeRun？重试 attempt 是否新 NodeRun 还是 NodeAttempt？
2. Graph Scheduler 的确定性依赖 recorded ready set，但 ready set 本身如何记录、如何 replay 仍需字段级规范。
3. SideEffect 状态机已经明显改善，但 compensation_required 后的补偿流程、补偿失败、人工确认仍需要状态机。
4. Reconciliation Worker 的查询权限、幂等键映射、外部系统不可查询时的最终处理策略需要补。

### 15.2 改善方案

新增：

```text
HarnessStep = semantic step
NodeRun = executable graph node instance
NodeAttempt = retry/redrive attempt under NodeRun
```

Scheduler event 必须记录：

```yaml
ready_set:
selected_node_ids:
ordering_policy_version:
worker_pool_snapshot_ref:
decision_reason:
```

SideEffect 补偿状态：

```text
compensation_required → compensation_planned → compensation_approved → compensation_committing → compensation_confirmed | compensation_failed | manual_review_required
```

---

# 16. §24 配置治理架构

### 16.1 问题

1. 配置版本化已存在，但需要明确哪些配置可以热更新，哪些必须 run admission 时锁定。
2. 灰度配置变更没有绑定 rollback guardrail 指标。
3. 安全配置紧急变更与 RunVersionLock 冲突时如何处理需要写明。
4. 多 Region 配置同步延迟对策略执行的影响未定义。

### 16.2 改善方案

配置分级：

```text
admission_locked_config
checkpoint_revalidated_config
hot_reloadable_config
emergency_override_config
```

配置灰度必须声明：

```yaml
rollback_metrics:
max_error_rate:
max_policy_denial_spike:
max_latency_regression:
```

---

# 17. §25 数据与状态一致性架构

### 17.1 问题

1. §25.6 仍写 Cross-region 复制使用 “async replication + conflict resolution”，虽然后文 §52 改为 single-leader；这里的 “conflict resolution” 容易被误解为多主冲突解决。
2. Projection lag 正常 ≤5s，但背压可达 60s；哪些 API 可以读 stale projection，哪些必须读 truth，仍需矩阵。
3. 86 张逻辑表仍被 §25 引入，虽有 migration 策略，但 MVP 表集还不够硬。
4. CAS + Lease + Fencing 三重检查的写热点缓解、批处理、退避策略需要继续具体化。

### 17.2 改善方案

把 “conflict resolution” 改为：

```text
failover reconciliation for unreplicated leader writes
```

读路径矩阵：

```text
approval decision page → truth
dashboard aggregate → projection
run detail after mutation → truth with read-after-write token
audit report → event/audit store
```

CAS 重试策略：

```text
max_retries = 3
backoff = 20ms, 50ms, 100ms + jitter
after_retries = requeue scheduler tick
```

---

# 18. §26 存储架构

### 18.1 问题

1. 86 张逻辑表对 Release Candidate 仍过重。
2. Group 表划分如果没有 Phase gate，会导致工程先建全量 schema。
3. SQLite → PostgreSQL 迁移策略已写，但数据体量、停机窗口、双写校验、回滚边界不够具体。
4. Artifact 与 Event/Audit 的引用完整性、对象存储 GC、legal hold 关系未完全闭合。

### 18.2 改善方案

强制 MVP 表集不超过 20 张：

```text
tenant
principal
task
harness_run
plan_graph
node_run
node_attempt
event_log
event_outbox
tool_definition
tool_call
side_effect
budget_ledger
budget_reservation
approval_request
decision_record
checkpoint
artifact_record
audit_record
idempotency_record
```

其余表必须标记 Phase。

---

# 19. §27 性能架构与 SLO

### 19.1 问题

1. 平台内部 P99、用户 SLA P95、域级 SLO 混在多处，仍存在口径不一致。
2. “LLM 延迟不计入平台自身 SLO”合理，但用户体验上 LLM 是端到端路径，必须另设 E2E SLO。
3. Dispatch latency 与 CAS/Lease/Fencing/预算预留/策略检查的组合成本需要压测基线。
4. P99 目标未按部署形态 D1/D2/D3 区分。

### 19.2 改善方案

分成三类指标：

```text
Internal Platform SLO: P99
User-visible E2E SLA: P95/P99 by tier
Provider Observed SLO: LLM/tool provider latency and error rate
```

每个 Phase 给出基线：

```text
D1 local p99
D2 worker split p99
D3 distributed p99
```

---

# 20. §28 Event Registry / Projection / Incident / DLQ

### 20.1 问题

1. Event Registry 已经引入，但事件 schema 与代码 schema 的关系仍需明确。
2. Projection rebuild 需要 checkpoint、水位线、重建隔离表、切换校验。
3. OapeflirEvent 作为投影事件时，必须防止消费者误把它当 truth source。
4. DLQ 重试如果重新触发 side effect，需要强制 simulation 或幂等确认。

### 20.2 改善方案

Event Registry 字段增加：

```yaml
source_of_truth: true|false
replayable: true|false
side_effect_safe_to_replay: true|false
schema_owner:
consumer_contract_tests:
```

Projection rebuild：

```text
build shadow projection → compare counts/hash → cutover → retain old projection for rollback
```

---

# 21. §29 Knowledge / Memory / Artifact / Learning 边界

### 21.1 问题

1. 本节篇幅过短，不足以承载 Memory 六层、Knowledge trust、Artifact evidence、Learning candidate 等关键边界。
2. Memory 淘汰策略虽然提到每层独立 TTL，但未给出默认优先级与 token 压缩策略。
3. Knowledge 降级路径需要更细，如 contested 状态下是否仍可被检索使用。
4. Artifact 的不可变性、hash、签名、retention、legal hold 应放入本节核心 contract。

### 21.2 改善方案

扩充本节为四个独立 contract：

```text
MemoryContract
KnowledgeTrustContract
ArtifactContract
LearningCandidateContract
```

Memory eviction 默认：

```text
working: never drop, compress only
procedural: never drop, summarize if needed
semantic: rank by trust + relevance + freshness
episodic: summarize first, then evict
session: bounded by session policy
meta: policy-controlled
```

---

# 22. §30 Business Pack 模型

### 22.1 问题

1. PackManifest 与 DomainDescriptor 的边界已经解释，但 Pack 能力、风险、工具、数据权限之间仍需一张强 schema。
2. Plugin / Connector / Pack 三者生命周期容易混淆。
3. Pack emergency disable 与已运行 HarnessRun 的处理策略不够细。
4. Business Pack 版本升级是否影响 in-flight run，需要和 RunVersionLock 对齐。

### 22.2 改善方案

新增：

```yaml
PackCapabilityProfile:
  tools:
  side_effects:
  data_classes:
  max_risk_class:
  requires_human_roles:
  supported_execution_modes:
```

Pack 禁用策略：

```text
new run blocked
in-flight low risk continue
in-flight high risk pause at checkpoint
critical security disable abort immediately
```

---

# 23. §31 容灾与高可用架构

### 23.1 问题

1. 单 Region HA 与 §52 Multi-Region 已经区分，但 RPO/RTO 在不同 HA 等级下仍需表格化。
2. Leader election 必须绑定 fencing epoch，但 §31 本节展开不足。
3. 备份恢复没有明确演练频率、恢复校验和证据记录。
4. read-only degraded 模式下哪些功能保留、哪些禁用需要明确。

### 23.2 改善方案

增加：

```text
HA-1: RTO hours, RPO backup interval
HA-2: RTO <30min, RPO <5min
HA-3: RTO <10min, RPO near-zero within region
Multi-region: see §52
```

每次 failover 生成：

```text
FailoverRecord
FencingEpochChanged
RecoveryValidationReport
```

---

# 24. §32 部署架构

### 24.1 问题

1. D1/D2/D3 与 S1-S4、Phase 1-7 的映射虽然在 §58.5 收口，但本节本身应内联引用。
2. 单体阶段下许多隔离能力只能“逻辑隔离”，不能承诺强隔离。
3. Browser executor、plugin sandbox、high-risk adapter 的部署边界应更早明确。
4. Kubernetes / multi-service 阶段的状态迁移复杂度未反映在路线图风险中。

### 24.2 改善方案

每个部署形态都写清：

```text
security isolation level
tenant isolation level
worker isolation level
supported risk tier
not supported capabilities
```

例如 D1 不支持：

```text
regulated critical domains
untrusted third-party plugin
multi-tenant strong isolation
```

---

# Part II — AI 运营层

---

# 25. §15 LLM Provider 抽象与故障切换

### 25.1 问题

1. §15.5 仍写“基于 prompt_ref + 参数 hash 的语义缓存”，这本质是精确缓存，不是语义缓存。
2. 如果真做语义相似缓存，需要 embedding、相似阈值、风险隔离、cache poisoning 防护。
3. provider 降级与 Evaluator/Judge 独立性之间的冲突虽在部分章节提及，但 §15 应作为源头定义。
4. provider routing 与数据驻留、输出 PII 扫描、模型训练使用限制应合并成统一路由约束。

### 25.2 改善方案

拆分缓存：

```text
ExactPromptCache: prompt_ref + canonical params hash
SemanticCache: embedding similarity + safe class + human-approved domain
```

默认 MVP 只实现 ExactPromptCache。

Provider routing 输入：

```yaml
data_residency:
pii_input_detected:
pii_output_possible:
model_training_opt_out_required:
judge_independence_required:
latency_tier:
cost_tier:
```

---

# 26. §16 Prompt 管理与版本化

### 26.1 问题

1. PromptBundle 与 Tool schema、Evaluator schema、DomainDescriptor schema 的兼容矩阵仍需明确。
2. Prompt rollback 对 in-flight run 的影响要和 checkpoint / bundle revocation 强绑定。
3. Full prompt logging 与隐私/密钥/客户数据保护冲突，需要 redaction-first 原则。
4. Prompt injection 防御不应只作为 prompt 管理问题，应联动 Tool Guardrails、Egress Control、Context Assembly。

### 26.2 改善方案

新增：

```text
PromptBundleCompatibilityMatrix
BundleRevocationEvent
PromptLogRedactionPolicy
PromptInjectionDefenseChain
```

---

# 27. §17 模型评估与质量门禁

### 27.1 问题

1. Eval dataset 大小、critical case 权重、领域分层标准仍需更严格。
2. Evaluator Prompt 独立不等于模型独立，Generator/Evaluator 仍可能使用同一模型或同一 provider。
3. LLM-as-Judge 不能作为监管级证据，只能作为辅助质量信号。
4. 线上 canary 指标与离线 eval 指标如何组合决策，需要标准公式。

### 27.2 改善方案

模型独立策略：

```text
low risk: same model allowed
medium: different model required
high: different model family required
critical: different provider + deterministic checks required
```

质量门禁：

```text
offline_eval_pass
critical_case_pass
online_canary_no_regression
domain_owner_approval
rollback_plan_present
```

---

# 28. §18 成本管理与 Token 计量

### 28.1 问题

1. Atomic reserve 已修复 TOCTOU，但热门租户 budget ledger 行仍可能成为写热点。
2. BudgetReservation 状态机没有 `partially_settled`，对于 streaming LLM 或分段工具执行可能不够。
3. 预留估算过高会造成预算“假耗尽”，估算过低会导致执行中超支，需要策略。
4. Prompt 缓存仍称语义缓存，应与 §15 修正同步。

### 28.2 改善方案

增加：

```text
budget_sub_ledger
reservation_shard
partial_settlement
overrun_policy
reservation_estimation_error_metric
```

预算分片：

```text
tenant_monthly_budget → tenant_budget_bucket[0..N]
periodic reconciliation
```

---

# 29. §19 Agent 间委托与协作

### 29.1 问题

1. 多 Agent 协作协议如果只定义消息格式，不定义状态机和序列号，仍会乱序。
2. Delegation 的 budget cap、capability intersection、data boundary、failure propagation 需要字段级定义。
3. 子 HarnessRun 与父 HarnessRun 的证据链、预算、审批继承关系需更明确。
4. 广播委托和多 Agent 协商容易造成成本风暴。

### 29.2 改善方案

Delegation 状态机：

```text
created → offered → accepted/rejected → running → completed/failed → verified → closed
```

消息字段：

```yaml
delegationId:
parentRunId:
childRunId:
seq:
expectedPreviousSeq:
capabilityIntersection:
budgetCap:
dataBoundary:
deadline:
```

---

# 30. §20 长时任务与 Workflow 休眠

### 30.1 问题

1. 休眠任务唤醒时的版本兼容已部分覆盖，但破坏性变更进入 recovery_needed 后的人工流程需补。
2. 外部 webhook 唤醒要和签名、幂等、重放攻击防护绑定。
3. 长时任务中 budget reservation、approval、secret lease、tool session 的过期联动需要统一。
4. 休眠最大时长和数据 retention / legal hold 可能冲突。

### 30.2 改善方案

唤醒前统一执行：

```text
version compatibility check
approval validity check
budget reservation refresh
secret lease reacquire
external callback signature verification
```

---

# 31. §21 人机协作模式

### 31.1 问题

1. HITL 模式与 §47 审批路由职责已在 §58.5 收口，但 §21 本节仍需把边界写在正文。
2. 协同编辑仍需要明确并发控制模型。
3. takeover / override / patch 的权限与审计字段需要标准化。
4. 人工介入后，Agent 是否可以继续自主执行，需要状态机约束。

### 31.2 改善方案

默认协同编辑模式：

```text
strict turn-taking token
```

人工介入命令：

```yaml
interventionType: inspect | patch | override | takeover | resume
authority:
scope:
expiresAt:
auditReason:
```

---

# 32. §22 SDK 与开发者体验

### 32.1 问题

1. SDK 覆盖面容易过大，MVP 应聚焦 pack scaffold、manifest validate、local mock run、contract test。
2. record/replay fixture 需要自动脱敏，否则会泄露客户数据和 secret。
3. SDK 与平台版本兼容矩阵缺失。
4. 本地模拟必须明确不能证明生产 SideEffect 安全，只能验证 contract。

### 32.2 改善方案

MVP SDK：

```text
create-pack
validate-manifest
run-local-simulation
generate-contract-tests
publish-dry-run
```

Fixture：

```text
redact secrets
hash PII
strip proprietary payload unless approved
```

---

# 33. §23 合规与数据治理

### 33.1 问题

1. 跨境数据处理已经更细，但合规机制（SCC/BCR/DPF/安全评估）需要作为配置和证据对象，而不是文本规则。
2. Crypto-shredding 与 immutable audit 的边界要落到字段级：哪些字段可删除，哪些只保留摘要。
3. Legal hold 与 retention/delete request 的冲突需要统一优先级。
4. LLM 输出生成 PII 后的隔离/事件流程需和 §52 对齐。

### 33.2 改善方案

增加：

```text
DataTransferRecord
LegalBasisRecord
RetentionOverride
ErasureTombstone
TenantNeutralAuditDigest
```

删除权处理：

```text
destroy encrypted payload
retain non-PII audit envelope
retain hash/digest for integrity
```

---

# Part III — 业务域接入层

---

# 34. §37 业务域建模与接入

### 34.1 问题

1. DomainDescriptor 已加入 execution_mode，这是重要修复；但字段还需要 schema 化，否则各域自由填写会失控。
2. DomainRiskProfile 覆写风险有价值，但仍缺少校准基准和审批流程。
3. 24 域比较矩阵过大，主文档可读性下降。
4. Canonical Domain Meta-Model 12 问模板需要版本化，否则新增问题会导致 24 域迁移。
5. conflict_strategy 应该是平台支持枚举或插件接口，不应任意文本。

### 34.2 改善方案

DomainDescriptor schema：

```yaml
schemaVersion:
domainId:
executionMode:
riskProfile:
dataClasses:
sideEffectTypes:
humanReviewPolicy:
sloProfile:
conflictResolutionPolicy:
```

CDM 版本：

```text
cdm-v1
cdm-v2
support window: 2 versions
migration required before deprecation
```

---

# 35. §38 业务域接入 Runbook

### 35.1 问题

1. Runbook 流程仍偏重，对 low-risk 内部域过度，对 critical regulated 域又不够细。
2. Gate 标准在 §17、§37、§38 之间可能不一致。
3. 领域接入完成后，持续复审、撤销认证、域配置漂移处理不足。
4. 接入流程与 Business Pack certification、Marketplace certification 有重叠。

### 35.2 改善方案

按风险分层：

```text
low: fast-track
medium: standard
high: enhanced
critical: regulated
```

每个域有：

```text
initial certification
periodic recertification
incident-triggered recertification
domain descriptor drift review
```

---

# Part IV — 24 垂直业务域

> 总体建议：24 域不应全部放在主架构文档中。主文档只保留 Domain Meta-Model 和 2-3 个代表性示例，其余拆到 `docs_zh/domains/`。

---

# 36. §71 量化交易域

### 问题

1. v4.1 已引入 deterministic hot path，但量化域仍应彻底声明：下单热路径不得经过通用 Harness loop。
2. 交易策略 artifact 的签名、回测证据、风险限额、kill switch 需字段级定义。
3. 市场数据延迟、时钟同步、滑点模型不是通用 Agent 平台能轻易覆盖的。

### 改善方案

```text
offline LLM planning only
compiled strategy artifact
pre-trade deterministic risk check
hot path no LLM / no HITL
post-trade audit and kill switch
```

---

# 37. §72 电商域

### 问题

1. 定价、库存、退款属于真实经济副作用，需与 SideEffectManager 绑定。
2. 错价、超卖、恶意促销需要专门熔断。
3. 商品内容合规与发布审批需要和 Artifact/Prompt 输出绑定。

### 改善方案

```text
price floor guard
inventory reservation
refund threshold
campaign rollback window
oversell incident workflow
```

---

# 38. §73 广告推广域

### 问题

1. 预算消耗速度可能远超一般 LLM 成本，需独立广告预算 ledger。
2. 创意合规与投放执行要分离。
3. 实时竞价不能依赖 LLM 热路径。

### 改善方案

```text
ad_spend_ledger
creative approval gate
bid adjustment bounds
deterministic bidding policy
```

---

# 39. §74 金融服务域

### 问题

1. 金融决策需 adverse action explanation、公平性评估和监管证据。
2. LLM-as-Judge 不可作为最终合规裁决。
3. 高风险动作应强制 human signoff。

### 改善方案

```text
adverse_action_explanation
fairness evaluation bundle
regulatory evidence bundle
licensed reviewer approval
```

---

# 40. §75 数据处理域

### 问题

1. 数据迁移、删除、重放、血缘之间的冲突需要更细。
2. Pipeline retry 必须要求 sink idempotency contract。
3. 数据质量规则应作为可版本化资产。

### 改善方案

```text
idempotent sink contract
lineage-aware replay
data quality rule versioning
shadow migration compare
```

---

# 41. §76 代码开发域

### 问题

1. Agent 修改代码必须默认 branch/PR 模式，不应直接写主干。
2. CI、SAST、dependency scan、license scan、secret scan 应作为 release gate。
3. 自动修复安全漏洞不能绕过 reviewer。

### 改善方案

```text
branch-only write
PR-required merge
mandatory CI + scans
CODEOWNER review
```

---

# 42. §77 用户运营域

### 问题

1. 用户触达频控需要平台级硬限制。
2. 分群可能推断敏感属性。
3. A/B 实验需要 consent、holdout 和伦理边界。

### 改善方案

```text
frequency cap
sensitive attribute detector
consent check
holdout protection
```

---

# 43. §78 行业调研域

### 问题

1. 调研报告每个事实主张应有引用，否则不可进入高信任知识库。
2. 抓取来源可能有版权/ToS 限制。
3. 预测类输出必须声明不确定性。

### 改善方案

```text
citation_required_for_claim
source license check
forecast confidence interval
```

---

# 44. §79 学术调研域

### 问题

1. 引用准确性需 DOI / CrossRef / PubMed 等验证机制，不能只靠 LLM。
2. 统计分析需要可复现环境。
3. 学术诚信边界需明确。

### 改善方案

```text
citation resolver
DOI verifier
reproducible notebook artifact
plagiarism / authorship policy
```

---

# 45. §80 企业知识库域

### 问题

1. 权限镜像延迟需定义 SLO。
2. RAG 回答必须默认带引用。
3. 知识过期与 trust downgrade 需要自动通知消费者。

### 改善方案

```text
query-time ACL check
citation required
permission mirror freshness SLO
stale knowledge alert
```

---

# 46. §81 财务域

### 问题

1. 多币种审批阈值、FX snapshot、财务证据不可变性需更强。
2. SoD 应是平台级能力，不只财务域规则。
3. 报表/凭证生成必须有签核链。

### 改善方案

```text
base_currency + FX snapshot
four-eyes approval
immutable financial evidence bundle
SoD engine
```

---

# 47. §82 法务域

### 问题

1. 法律信息/法律意见边界应更硬。
2. privilege、jurisdiction、legal hold 需要作为数据分类一等字段。
3. 法律输出必须强制律师审核或免责声明。

### 改善方案

```text
legal_information_only by default
attorney_review_required for advice
privilege classification
jurisdiction-aware retrieval
```

---

# 48. §83 在线直播域

### 问题

1. 实时审核热路径不能依赖远程 LLM。
2. 断流是高风险不可逆副作用，需 appeal/reinstate。
3. 未成年人保护规则应进入 policy engine。

### 改善方案

```text
edge moderation
deterministic blocklist
stream kill switch
appeal workflow
minor protection policy
```

---

# 49. §84 广告素材制作域

### 问题

1. 版权相似性检测、素材 provenance、水印和品牌审批需要成为 Artifact contract。
2. 生成素材不能直接发布到外部渠道。
3. 品牌规则需版本化。

### 改善方案

```text
asset provenance
copyright similarity scan
C2PA metadata
brand guideline versioning
```

---

# 50. §85 游戏开发域

### 问题

1. 资产版权和第三方素材许可风险较高。
2. 数值平衡不应自动写生产配置。
3. QA 证据应和 release gate 绑定。

### 改善方案

```text
IP similarity scan
balance config approval
automated QA evidence
release gate
```

---

# 51. §86 游戏上架域

### 问题

1. 各平台政策差异大，不能用一个统一审核结果。
2. 防沉迷、支付、年龄分级、地区政策需版本化。
3. LiveOps 配置可能造成经济损失。

### 改善方案

```text
per-platform compliance matrix
age rating validation
anti-addiction policy check
liveops approval
```

---

# 52. §87 人力资源域

### 问题

1. 简历筛选应是 recommendation-only，不能自动淘汰。
2. 受保护属性和代理变量需要检测。
3. HR 数据默认不进入长期共享 memory。

### 改善方案

```text
recommendation-only
bias audit
protected attribute handling
no long-term memory by default
```

---

# 53. §88 供应链与物流域

### 问题

1. 大额采购、危险品、出口管制需硬审批。
2. 预测错误可能造成库存灾难，应有异常熔断。
3. 离线 side effect 依赖链要拓扑提交。

### 改善方案

```text
procurement threshold
export control screening
forecast anomaly circuit breaker
side_effect dependency graph
```

---

# 54. §89 医疗健康域

### 问题

1. 必须明确“临床决策支持”而非诊断主体。
2. PHI 隔离、医师签核、紧急场景 no LLM hot path 需要写入硬约束。
3. 医疗证据链必须不可篡改。

### 改善方案

```text
clinical decision support only
physician signoff
PHI isolation
emergency deterministic path
medical evidence bundle
```

---

# 55. §90 教育培训域

### 问题

1. 未成年人数据保护与家长/学校 consent 需要硬化。
2. 学术诚信和“直接给答案”风险需 guardrail。
3. 内容年龄分级需策略化。

### 改善方案

```text
guardian consent
age-tier policy
socratic tutoring mode
academic integrity guardrail
```

---

# 56. §91 客户服务域

### 问题

1. Agent 承诺内容可能产生法律/商业责任。
2. 退款/补偿是真实 SideEffect。
3. 3 轮未解决转人工应成为硬规则。

### 改善方案

```text
promise checker
refund threshold approval
max_unresolved_turns = 3
sentiment escalation
```

---

# 57. §92 内容审核与安全域

### 问题

1. CSAM/极端内容等处理需要辖区化流程。
2. 误判申诉和证据留存需专门状态机。
3. 审核员保护属于组织流程，也要记录为治理要求。

### 改善方案

```text
jurisdiction-specific report workflow
appeal evidence bundle
moderator safety policy
```

---

# 58. §93 IT 运维 SRE/DevOps 域

### 问题

1. 自动修复必须限制爆炸半径。
2. unknown incident 不应自动修复。
3. 自运维 Agent 与平台故障形成循环依赖。

### 改善方案

```text
known-runbook-only auto fix
blast radius limit
change window enforcement
out-of-band break-glass
```

---

# 59. §94 市场营销与品牌域

### 问题

1. 对外发布应默认人工审批。
2. 危机公关不得自动发布。
3. 广告法、品牌语气、退订合规需进入 output guardrails。

### 改善方案

```text
brand approval gate
crisis PR takeover
ad law checker
unsubscribe compliance
```

---

# Part V — 智能交互层

---

# 60. §39 自然语言任务入口

### 问题

1. Intent Parser 不能直接信任 LLM 输出，必须 schema validation。
2. 高风险自然语言指令需要 dry-run preview。
3. 多轮上下文进入 memory 的数据分级规则需更明确。
4. 模糊意图确认阈值未统一。

### 改善方案

```text
intent_confidence_threshold
slot_confidence_threshold
schema validation
risk preview
dry-run for high-risk
```

---

# 61. §40 目标分解引擎

### 问题

1. Goal → Task → Step 应完全对齐 PlanGraph，而不是形成另一套树结构。
2. 预算、风险、权限、数据边界需要在分解时传播。
3. LLM 分解结果必须经过 deterministic graph validation。

### 改善方案

```text
GoalGraph → TaskGraph → PlanGraphBundle
DAG validation
budget propagation
risk propagation
capability validation
```

---

# 62. §41 主动式 Agent 框架

### 问题

1. 主动任务与用户任务共享预算和资源，仍可能抢占。
2. max_fire_rate 只有次数，没有成本上限。
3. 触发器之间可能形成反馈环。
4. 中高风险主动动作默认应是 suggestion，不是 execution。

### 改善方案

```text
proactive_budget_cap
user_task_budget_reserve >= 60%
trigger feedback loop detection
default suggestion mode for medium+
```

---

# 63. §42 渐进式自主权模型

### 问题

1. TrustScore 不再降低风险，这是正确的；但 90d 衰减仍是断崖。
2. 晋升条件只看成功率/失败率，未按任务复杂度和风险加权。
3. domain_owner 可豁免衰减参数，可能绕过平台安全边界。
4. “full_auto 级静默执行”需受 DomainCapability 和 SideEffect 风险硬约束。

### 改善方案

```text
continuous decay instead of cliff
risk-weighted trust score
complexity-weighted success
platform-level max autonomy cap
```

---

# 64. §43 统一运营看板

### 问题

1. 指标来源、freshness、owner、actionability 未完全定义。
2. L1 自然语言摘要可能泄露敏感信息。
3. 多 Region 看板读取 projection 时可能 stale。
4. 看板操作按钮可能直接触发高风险 ControlDirective，需要二次确认。

### 改善方案

```text
MetricRegistry
metric_owner
freshness_slo
summary redaction
dashboard action risk gate
```

---

# 65. §44 非技术用户体验

### 问题

1. 单人模式下高风险自审批需要更强补偿控制。
2. “3 分钟接入”等体验目标要避免成为工程承诺。
3. 可视化 workflow 编辑器必须是 PlanGraph 的 projection，而不是另一个 DSL。
4. WCAG 需要自动化验收测试。

### 改善方案

```text
solo high-risk = dry-run + cooldown + rollback window
visual builder = PlanGraph editor
accessibility test suite
```

---

# Part VI — Harness 工程化与八支柱

---

# 66. §45 Harness Runtime 权威执行模型

### 问题

1. 章节说 “Harness 不替代现有模块”，但又说 HarnessRuntime 是唯一可执行运行时。措辞上仍有轻微矛盾。
2. `PlanBundle` 作为产品 wrapper 可以保留，但必须确保任何执行路径都不能消费 PlanBundle。
3. ContextAssembler、Memory Namespace、ToolbeltAssembler、Evaluator、HITL Runtime 都很完整，但契约字段非常多，MVP slice 需明确。
4. Evaluator 与 Generator 只要求 prompt 独立还不够，需要模型/供应商独立策略。
5. HarnessDecision 当前说六种裁决，但 §58.6 需要纳入 quarantine、revoke_approval、pause_for_external、require_revalidation 等实际生产裁决。

### 改善方案

措辞改为：

```text
HarnessRuntime 不替代业务模块；但替代所有分散执行入口，成为唯一执行入口。
```

MVP Harness 仅保留：

```text
ConstraintPack
Toolbelt minimal
ContextSnapshot minimal
PlanGraphBundle
NodeRun
Evaluator basic
HITL approval
Trace Replay
```

HarnessDecision 扩展为：

```text
accept
retry
replan
escalate
downgrade_mode
abort
quarantine
revoke_approval
pause_for_external
require_revalidation
```

---

# 67. §58 Harness 横切关注面

### 问题

1. `harness.run.duration` SLO 写 “P99 < 业务域 SLO 定义”，仍是循环引用，需要默认值或绑定字段。
2. Failure-to-Learning 缺少偏差、多样性和污染防护。
3. Replay/Simulation 已区分 Trace 与 Re-execution，这是正确的，但策略对比、Prompt A/B、工具替换应强制隔离 budget 和数据。
4. §58.5 架构遗留问题收口表很有用，但应该转为 ADR/issue registry，避免正文长期背负历史债。

### 改善方案

```text
HarnessMetricRegistry.default_slo
LearningCandidateQualityGate
ReplaySandboxPolicy
LegacyResolutionRegistry
```

---

# Part VII — 组织治理层

---

# 68. §46 组织层次模型

### 问题

1. 部门合并时 Pack、Policy、DomainOwner、ApprovalChain 冲突仍需更具体。
2. 组织变更对 in-flight approval 和 ownership 的影响需要定义。
3. 离职用户 owned Agent 迁移要考虑无人接管时的冻结策略。

### 改善方案

```text
OrgMergeConflictReport
ApprovalRerouteOnOrgChange
OrphanAgentFreezePolicy
```

---

# 69. §47 组织架构审批路由

### 问题

1. 多币种审批阈值仍需统一 base currency + FX snapshot。
2. peer delegate 需要利益冲突过滤。
3. 审批过期、撤回和 commit-time revalidation 需放在本节。
4. SoD 不能只做 requester != approver。

### 改善方案

```text
ConflictOfInterestFilter
approval_expiry
approval_revocation
commit_time_revalidation
SoD policy engine
```

---

# 70. §48 企业 SSO/SCIM 集成

### 问题

1. SCIM 停用用户后的 Agent ownership 迁移策略还需细化。
2. IdP sync 异常需要 DLQ。
3. Session revocation SLO 需要明确。
4. shared/team agent 的 owner fallback 未定义。

### 改善方案

```text
identity_sync_dlq
session_revocation_slo
shared_agent_owner_fallback
SCIM conflict report
```

---

# 71. §49 分部门合规策略引擎

### 问题

1. “只能收紧不能放松”正确，但严格性不总是全序。
2. 合规例外流程、过期、审计和回收未完全定义。
3. Evidence quality 与控制点覆盖率应作为一等指标。

### 改善方案

```text
PolicyStrictnessComparator per policy type
ComplianceExceptionWorkflow
EvidenceQualityScore
ControlCoverageReport
```

---

# 72. §50 知识域隔离与受控共享

### 问题

1. Chinese Wall 需要 expiry/reset，否则用户长期使用后权限会越来越窄。
2. “不暴露知识存在性”与审计/debug 需求冲突，需要审计员视图。
3. controlled sharing 需要脱敏、摘要、字段级过滤。

### 改善方案

```text
WallExpiryPolicy
ComplianceOfficerAuditView
CrossBoundaryTransform
```

---

# 73. §51 分级治理委托

### 问题

1. super_admin 与不可侵犯 Runtime Invariants 的边界仍需写得更硬。
2. delegation 应有有效期、范围、撤销。
3. 下级不能放松策略时，策略严格性比较需要类型化。

### 改善方案

```text
RuntimeInvariant immutable by any admin
DelegationExpiry
DelegationScope
PolicyComparator
```

---

# Part VIII — 规模化运行层与生态层

---

# 74. §52 多 Region 部署架构

### 问题

1. 已修复 active-active truth 写入风险，这是关键进步。
2. §52.3 仍写 “CN 执行，LLM 请求路由到 US，输入/输出不含 PII 时允许跨境”，但输出 PII 的检测流程需要和 §52.4 控制链更硬绑定。
3. failover 手动/半自动时，§54 已降至 99.95%，合理；但 RTO/RPO 和 SLA Tier 的映射需要更细。
4. Global Control Plane 自身的 HA、数据驻留和 blast radius 未定义。

### 改善方案

```text
cross-border input scan + output scan
Global Control Plane metadata-only
per-partition home region
failover RTO/RPO by tier
```

---

# 75. §53 规模化资源竞争管理

### 问题

1. 自动优先级升级如果没有配额，会让所有任务在高负载下都变 high。
2. Resource quota 需要覆盖 worker、tool QPS、model TPM/RPM、budget、approval capacity。
3. Preemption 前必须 checkpoint，否则破坏 durable execution。
4. 租户公平性与 SLA tier 之间需要明确权重公式。

### 改善方案

```text
weighted aging
promotion budget per tenant
checkpoint-before-preempt
multi-resource quota vector
```

---

# 76. §54 SLA 分级保障

### 问题

1. §54.1 字段叫 `maxLatencyP99`，§54.2 矩阵列叫 P95 延迟，仍不一致。
2. Availability 与 queue limit、recovery priority 没有落实成调度公式。
3. SLA 还应包含 incident response、approval latency、recovery time。
4. Platinum 99.95 已和手动/半自动 failover 对齐，但 99.99 专用档需要单独命名，不应只写一句。

### 改善方案

```text
ExternalSLA.p95Latency
InternalSLO.p99Latency
DedicatedPlatinum99_99 profile
approval_latency_slo
incident_response_slo
```

---

# 77. §55 Agent 市场与生态

### 问题

1. Marketplace 对 MVP 来说仍然过重。
2. Removed 状态需要安装迁移保障和关键业务保护。
3. 第三方 Pack/Plugin 的供应链认证需与 §11 安全基线强绑定。
4. 收益分成和商业规则不应放在核心架构主文档。

### 改善方案

```text
MVP = internal pack registry only
Marketplace = Enterprise/Future
removed requires migration threshold
SBOM + signing + sandbox certification
```

---

# 78. §56 反馈驱动持续改进管线

### 问题

1. Failure-to-Learning 虽要求人工审核，但训练样本选择偏差、多样性和污染防护不足。
2. 自动 routing 优化可能绕过数据驻留、合规和模型独立要求。
3. 用户反馈质量差异很大，需要可信度分级。
4. 改进候选与 ADR、Prompt rollout、Eval gate 的状态机应统一。

### 改善方案

```text
FeedbackTrustScore
CandidateDiversityScore
DataResidencyConstrainedOptimization
ImprovementCandidateStateMachine
```

---

# 79. §57 外部系统集成框架

### 问题

1. Connector 抽象仍需 action-level risk profile。
2. Health check 不能只检查连接，还要检查权限、配额和业务能力。
3. Credential rotation 与 secret lease 需要对齐。
4. MCP/Browser/DB/HTTP Connector 风险差异应分层。

### 改善方案

```text
ConnectorCapabilityProfile
ActionRiskProfile
PermissionProbe
CredentialRotationPolicy
```

---

# Part IX — 运营成熟度层

---

# 80. §59 可解释性与决策透明度

### 问题

1. 解释必须基于决策时记录的证据，不应事后让 LLM 猜测原因。
2. 解释查询需要按用户权限过滤，避免泄露隐藏知识或跨租户信息。
3. L3 forensic 解释成本可能很高，需要 budget。
4. 解释版本要和 Prompt/Policy/PlanGraph 版本绑定。

### 改善方案

```text
DecisionRationale captured at decision time
permission-aware explanation
forensic explanation budget
version-bound explanation
```

---

# 81. §60 紧急制动与全局熔断

### 问题

1. Panic 不自动解除已修复，这是正确的。
2. <5s 同 Region 全平面确认对分布式环境仍很激进，需要区分“阻断入口”和“确认所有 worker 已停止”两个指标。
3. P4 “回滚未提交 side effect”表述需谨慎：真实外部副作用不能回滚，只能补偿或对账。
4. break_glass 8h 自动恢复 read-only 仍有风险，应确保安全团队确认或仅恢复 forensic/monitoring。

### 改善方案

分两类指标：

```text
ingress_block_time < 5s
execution_quiescence_time < N seconds by deployment
```

P4 文案改为：

```text
stop new side effects, reconcile ambiguous side effects, compensate where supported
```

---

# 82. §61 Agent 统一生命周期管理

### 问题

1. testing/staging 回退到 draft 需要明确。
2. AgentVersion 内部 component compatibility matrix 仍需更强。
3. active → deprecated → removed 对关键业务 Agent 需迁移保护。
4. paused 恢复时必须重新评估 trust、policy、domain descriptor。

### 改善方案

```text
draft ↔ testing ↔ staging → canary → active
component compatibility matrix
migration required before removed
resume revalidation
```

---

# 83. §62 离线与边缘部署

### 问题

1. 设备被盗、篡改、离线伪造仍是最大缺口。
2. SyncQueue 的 side effect 依赖链需要更强。
3. Edge 模型/规则更新的签名和回滚未定义。
4. 离线期间 secret、PII、PHI 的本地加密策略需细化。

### 改善方案

```text
device identity
secure boot
disk encryption
remote wipe
signed sync queue
topological side-effect sync
signed model/rule updates
```

---

# 84. §63 Agent 行为漂移检测

### 问题

1. 高级漂移检测容易过度工程，MVP 只需阈值和趋势。
2. 2σ 阈值对非正态数据可能误判。
3. 漂移自动降级需考虑业务连续性。
4. 可被“假任务保活”博弈。

### 改善方案

MVP 指标：

```text
success_rate_drop
override_rate_spike
cost_spike
tool_usage_shift
incident_count
```

高级统计 Phase 6+。

---

# 85. §64 成本归因与优化引擎

### 问题

1. 成本归因应以 BudgetReservation/settlement 为事实来源。
2. 自动优化模型选择不能绕过合规和质量门禁。
3. What-if 成本节省估算必须标记为 advisory。
4. Worker/infra 成本也需要纳入，不只是 LLM。

### 改善方案

```text
cost = llm + tool + worker + storage + egress + human_review
optimization constrained by policy
what-if advisory only
```

---

# 86. §65 工作流可视化调试器

### 问题

1. IDE 级调试能力仍偏重，应后置。
2. 断点/step-into 生产 run 风险很高，应只在 replay sandbox。
3. Debugger 权限极高，需要强审计。
4. 时间旅行必须基于 Trace Replay，不得重写 truth。

### 改善方案

分层：

```text
Debug Lite: timeline + evidence inspect
Debug Pro: trace replay + compare
Debug IDE: breakpoint/watchpoint only sandbox
```

---

# 87. §66 合规报告自动生成

### 问题

1. 自动生成报告不等于合规确认，需要签核。
2. Evidence quality、coverage、freshness 需要指标。
3. 审计员访问报告仍需最小权限和脱敏。
4. 报告生成时的 schema/policy/data snapshot 需锁定。

### 改善方案

```text
ReportVersionLock
EvidenceQualityScore
ControlCoverageReport
AuditorAccessAudit
HumanSignoff
```

---

# 88. §67 容量规划与成本预测

### 问题

1. 预测模型不应成为早期依赖。
2. 容量规划要和 SLA、queue、budget、provider quota 联动。
3. Region failover 需要预留容量。
4. 预测准确率指标应后置。

### 改善方案

MVP：

```text
threshold alert
trend projection
queue depth forecast
provider quota monitor
failover capacity reserve
```

---

# 89. §68 多模态能力

### 问题

1. 多模态数据需要 ContentPart schema。
2. 图像/音频/视频 guardrail 和成本计量不同于文本。
3. Binary artifact 必须通过 artifact_ref，不应内联。
4. C2PA/provenance 应进入 Artifact contract。

### 改善方案

```text
ContentPart schema
modality-specific guardrails
artifact_ref only
provenance metadata
modality cost ledger
```

---

# 90. §69 平台自运维 Agent

### 问题

1. 平台故障时自运维 Agent 可能失效，存在循环依赖。
2. PlatformOps Agent 写操作需严格审批。
3. 不能访问业务数据边界需要技术实现。
4. L1/L2/L3 成熟度需要验收指标。

### 改善方案

```text
out-of-band recovery runbook
read-only by default
ops data boundary
human approval for writes
```

---

# Part X — 落地路线与汇总

---

# 91. §33 分阶段落地路线

### 问题

1. Phase 1-7 加 Phase 8a-8d 加 Phase 9a-9f 仍然过重。
2. Phase 8a 可与 Phase 3 并行，但 HarnessRuntime 是唯一执行入口，实际上应该更早进入 MVP。
3. Phase 5 才做自然语言、组织治理、域接入，但审批路由/组织权限对高风险 side effect 是早期刚需。
4. Phase 6 要 1000 并发、Marketplace 20 Pack、双 Region，跨度仍大。
5. Phase 9 48 周 24 域仍然会拖慢主线。

### 改善方案

重切为：

```text
MVP 8-12 weeks:
  HarnessRuntime entry
  PlanGraph
  NodeRun
  BudgetReservation
  SideEffectManager
  HITL basic
  TraceReplay
  CLI inspect

Hardening 3-6 months:
  Recovery
  Projection rebuild
  Incident/DLQ
  Config governance
  Org approval
  Prompt/eval rollout

Enterprise 6-18 months:
  Multi-region
  Marketplace
  Edge
  Advanced domains
```

Phase 9 改为：

```text
domain waves independent
platform milestone = N/24 domains GA
```

---

# 92. §34 ADR 冻结建议

### 问题

1. ADR 数量仍然多，容易变成“先冻结一切”。
2. ADR 混合 runtime、domain、governance、product、ops。
3. ADR 与代码实现、测试、schema 的映射需要强制。
4. 被 v4.1 修复的问题应生成 superseded ADR。

### 改善方案

ADR 模板：

```yaml
adr_id:
phase:
status:
decision:
runtime_contract_ref:
schema_ref:
test_ref:
supersedes:
owner:
```

ADR 分组：

```text
P0 Runtime ADR
P1 State/Evidence ADR
P2 Safety/Governance ADR
P3 Domain ADR
```

---

# 93. §35 推荐代码目录

### 问题

1. 目录树仍然过大，容易产生大量空目录。
2. OAPEFLIR、Harness、orchestration、runtime、state-evidence 路径需要防止职责重叠。
3. 24 域目录不应一次性创建全量实现。
4. tests 目录应按 invariants 和 runtime contracts 组织，而不只是模块映射。

### 改善方案

MVP 目录：

```text
src/platform/contracts
src/platform/harness
src/platform/plangraph
src/platform/execution
src/platform/state
src/platform/evidence
src/platform/control
src/platform/model_gateway
src/packs/core
```

测试目录：

```text
tests/invariants
tests/contracts
tests/replay
tests/side_effects
tests/budget
```

---

# 94. §36 风险、约束与成功标准

### 问题

1. 风险列表需要 owner、likelihood、impact、mitigation status。
2. 硬约束仍应拆分为 runtime invariant、policy rule、governance requirement、domain compliance。
3. 成功标准中不少目标仍是宏观目标，不是可验收测试。
4. Phase 8 / Phase 9 成功标准应改为独立 gate，而不是主线阻塞条件。

### 改善方案

Risk Register：

```yaml
risk_id:
severity:
likelihood:
impact:
owner:
mitigation:
test_or_drill:
status:
```

约束分层：

```text
machine-enforced invariant
policy-enforced rule
human-governed process
domain-specific compliance
```

---

# Part XI — 结论与附录

---

# 95. §70 结论

### 问题

1. 结论仍偏愿景，应该强调 v4.1 后下一步是“减法、收敛、规格化”。
2. 十层架构总结很好，但需要标注哪些是 MVP 核心层，哪些是扩展层。
3. Harness 八支柱总结应绑定测试和 contract，而不是仅总结能力。

### 改善方案

结论改为：

```text
v4.2 的目标不是扩展更多能力，而是把 HarnessRuntime、PlanGraph、Budget、SideEffect、Replay、Panic、Approval、Evidence 变成可测试的运行契约。
```

---

# 96. 附录 G：术语表

### 问题

1. 术语表缺少 canonical/deprecated/alias 标记。
2. `ExecutionPlan`、`PlanBundle`、`PlanGraphBundle`、`HarnessStep`、`NodeRun` 这些容易混淆的术语需要更强定义。
3. 缺少 “不得使用” 的遗留术语列表。

### 改善方案

术语字段：

```text
term
status: canonical | alias | deprecated
canonical_term
owner_section
runtime_entity: true|false
```

---

# 97. 附录 H：OAPEFLIR v4.4 Executable Spec 与 v4.1 收敛规则

### 问题

1. 这是当前最大文档治理风险：正文 v4.1 与附录 v4.4 同时存在。
2. H.3 “不可降级条款”很好，但需要进入正文 invariant registry，而不是只在附录。
3. H.2 完整规范章节索引引用外部文件，若该文件与正文不一致，冲突解决规则不够硬。
4. “Executable Spec 是运行时行为唯一权威源”与正文“v4.1 Release Candidate”需要统一。

### 改善方案

下一版处理方式二选一：

```text
方案 A：升级主文档为 v4.4，正文吸收 Executable Spec，不再附录引用。
方案 B：主文档保持 v4.2，附录 H 只列迁移来源，不作为实现权威。
```

不可降级条款移入 §2：

```text
Invariant Registry / Non-regression Rules
```

---

# 98. 附录 A：版本变更历史

### 问题

1. 版本历史过短，无法体现 v4.1 相对前版吸收了哪些重大修复。
2. v4.4 spec 的关系没有在变更历史中说明。
3. 没有 breaking changes、migration notes、deprecated terms。

### 改善方案

版本历史格式：

```text
version
status
major changes
breaking changes
deprecated terms
migration guide
superseded ADR/spec
```

---

# 99. 建议的 v4.2 整改包

## 99.1 P0：必须进入下一版正文

1. 统一 v4.1 / v4.4 权威关系。
2. 废弃 `ExecutionPlan` 作为 canonical 名称，只保留 `PlanGraphBundle`。
3. 全文替换泛化 `ControlDirective`，改成 `OperationalDirective` / `DecisionDirective`。
4. API 增加 PlanGraph / NodeRun / SideEffect / BudgetReservation / Replay。
5. Outbox Poller 增加 TTL、heartbeat、hot standby、delivery gap SLO。
6. Webhook retry policy 完整化。
7. SLA P95/P99 统一。
8. §25 Cross-region “conflict resolution” 改为 failover reconciliation。
9. §29 Memory/Knowledge/Artifact/Learning 扩充为正式 contract。
10. §33 路线图重切为 MVP / Hardening / Enterprise。

## 99.2 P1：Hardening 前完成

1. TrustScore 连续衰减，取消 90d 断崖。
2. BudgetLedger 分片 / sub-ledger。
3. Prompt cache 拆 exact cache / semantic cache。
4. DomainDescriptor schema 化。
5. Conflict strategy 闭合枚举。
6. Connector action-level risk profile。
7. Delegation 状态机和消息 seq。
8. Approval expiry / revocation / commit-time revalidation。
9. Legal hold / retention / erasure 统一。
10. Panic 指标拆成 ingress block 与 execution quiescence。

## 99.3 P2：Enterprise 前完成

1. Marketplace 从主线移出，作为 Enterprise/Future。
2. Edge security model。
3. Debugger 分层。
4. PlatformOps out-of-band recovery。
5. Multi-region Global Control Plane HA。
6. 24 域拆分为独立域文档。
7. Advanced drift detection 后置。
8. Full compliance report evidence quality。

---

# 100. 建议文档重组

```text
docs_zh/architecture/
  00-platform-architecture-core.md
  01-runtime-harness-plangraph.md
  02-state-evidence-consistency.md
  03-control-risk-governance.md
  04-ai-operations.md
  05-domain-onboarding.md
  06-org-governance.md
  07-scale-ha-sla.md
  08-ops-maturity.md
  09-roadmap.md
  10-invariant-registry.md
  11-api-contracts.md
  12-event-registry.md
  domains/
    71-quant-trading.md
    72-ecommerce.md
    ...
```

主文档目标控制在 3000-4000 行；域文档、API、Event Registry、Executable Spec 独立维护。

---

# 101. 最终结论

v4.1 已经从上一版的“能力全景”升级为“有生产运行语义的架构候选版”。最重要的方向都已经写对：HarnessRun 权威化、PlanGraph、Trace Replay、Budget atomic reserve、SideEffect 状态机、Panic 不自动解除、Multi-Region single leader、Deterministic hot path。

但 v4.1 还不能直接作为实现冻结版。主要原因是：

1. **版本权威未统一**：v4.1 正文与 v4.4 Executable Spec 同时存在。
2. **契约命名仍有遗留**：ExecutionPlan、ControlDirective、workflow steps 等旧词仍在多处出现。
3. **运行对象 API 未闭合**：PlanGraph、NodeRun、SideEffect、BudgetReservation、Replay 尚未成为 API 一等对象。
4. **生产细节仍有缺口**：Outbox failover、Webhook retry、SLA 口径、Budget 热点、Memory contract、Approval revocation 等需要补齐。
5. **路线图仍过大**：Phase 8/9 和三环模型需要进一步裁剪，否则团队会被外围能力拖慢。

下一版建议定位为：

```text
v4.2 = 可实现规格收敛版
目标：统一权威源 + 删除遗留契约名 + 补齐核心运行对象 API + 固化 MVP Slice + 把核心不变量变成可测试 contract
```
