# 平台总体架构 v4.0 → v4.1 可执行整改台账

> **文档名称**：平台总体架构 v4.0 方案审查问题整改吸收方案  
> **目标版本**：平台总体架构 v4.1 / OAPEFLIR-Harness 收敛版  
> **输入来源**：平台总体架构 v4.0 方案设计审查报告  
> **审查日期**：2026-04-26 / 2026-04-27  
> **整改口径**：稳定性优先、运行时权威模型收敛、MVP 可落地、长期生产可运维  
> **问题总数**：57 项  
> **覆盖范围**：Critical / Consistency / Design Flaw / Over-Engineering / Gap / Operations & Governance / Roadmap / Structure  

---

# 0. 总体整改结论

本次审查暴露的问题不是单点疏漏，而是平台总体架构进入 v4.0 后出现了典型的“大平台蓝图膨胀”问题：

1. **权威运行时模型不收敛**  
   OAPEFLIR、Harness、Run、Graph、StateMachine、Replay 多套概念并存，导致实现时难以确定哪个对象拥有最终执行权。

2. **路线图过重，MVP 不够尖锐**  
   当前文档覆盖能力极全，但没有明确 8-12 周可落地的最小生产闭环，导致团队容易在外围能力上消耗大量时间。

3. **强一致原语与多 Region Active-Active 承诺冲突**  
   CAS、Lease、Fencing、Budget Ledger、SideEffect Commit 都天然要求单写入权威源，不能直接宣称多 Region active-active write。

4. **LLM 不确定性与生产审计要求冲突**  
   LLM 不能作为确定性 Replay 的基础。审计、事故复盘和合规必须基于记录过的 Trace Replay，而不是重新调用模型。

5. **风险、审批、预算、SideEffect、Panic 等生产硬语义仍需补强**  
   当前已有大量概念，但关键状态机缺少撤回、过期、失败确认、冲突解决、预算释放等生产必备分支。

因此 v4.1 的核心不是继续增加新能力，而是：

> **收敛运行时权威模型，缩小 MVP，补齐硬语义，删除不可兑现承诺，将“企业级 Agent 平台蓝图”改造成“可长期稳定运行的生产系统设计”。**

---

# 1. v4.1 顶层整改原则

## 1.1 Harness 是唯一可执行运行时，OAPEFLIR 是语义框架

### 整改前问题

OAPEFLIR 与 Harness 同时被描述为运行时主模型；OapeflirRun 与 HarnessRun 状态机重复。

### v4.1 决策

| 层次 | 权威对象 | 定位 |
|---|---|---|
| 概念 / 方法论层 | OAPEFLIR | 描述 Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release 的认知与治理阶段 |
| 可执行运行时层 | HarnessRuntime | 唯一运行时入口 |
| 运行实体 | HarnessRun | 唯一权威运行实体 |
| 步骤实体 | HarnessStep / NodeRun | 唯一权威步骤实体 |
| OAPEFLIR 记录 | OapeflirTraceProjection | 从 HarnessRun 事件投影生成，不拥有执行权 |

### 强制不变量

```text
任何任务只能创建一个 HarnessRun。
OAPEFLIR 不创建独立 Run。
OAPEFLIR 阶段状态只能作为 trace / projection / rationale 存在。
HarnessRun 状态迁移是唯一可执行状态迁移。
```

---

## 1.2 Plan 必须是 Graph，但归属 Harness Plan Contract

### v4.1 决策

PlanGraph 归属于 `HarnessRun.plannerOutput.planGraphBundle`：

```text
HarnessRun
  └── plannerOutput
      └── PlanGraphBundle
          ├── planGraph
          ├── validationReport
          ├── riskPropagationReport
          ├── budgetReservationPlan
          ├── graphPatchPolicy
          └── schedulerPolicy
```

### 文档落点

| 内容 | 落点 |
|---|---|
| OAPEFLIR 中 Plan 是 graph 的原则 | §13 |
| PlanGraph Contract | §45 |
| Graph Scheduler | §14 |
| Graph Replay | §28 / §58 |
| GraphPatch | §45 / §58 |

---

## 1.3 默认使用 Trace Replay，不假设 LLM 可确定性重放

### v4.1 Replay 分类

| 类型 | 是否确定 | 是否重新调用 LLM / Tool | 用途 |
|---|---:|---:|---|
| Trace Replay | 是 | 否 | 审计、事故复盘、投影重建、调试 |
| Re-execution Replay | 否 | 是 | 回归测试、Prompt 对比、工具迁移仿真 |

### 强制不变量

```text
审计默认使用 Trace Replay。
Trace Replay 不得重新调用 LLM。
Trace Replay 不得产生真实 SideEffect。
Re-execution Replay 必须标记 nondeterministic。
Re-execution Replay 结果不得覆盖原 Evidence。
```

---

## 1.4 超低延迟 / 高风险热路径使用确定性执行

### v4.1 双模式执行

| 模式 | LLM 是否允许进入热路径 | 用途 |
|---|---:|---|
| Assisted Planning Mode | 允许 | 离线规划、策略设计、候选方案生成 |
| Deterministic Execution Mode | 禁止 | 量化交易下单、实时风控、直播断流、IT 自动修复等热路径 |

### DomainDescriptor 新增字段

```yaml
execution_mode:
  planning_mode: llm_assisted | deterministic_only
  hot_path_mode: deterministic_only | llm_allowed
  llm_in_hot_path_allowed: boolean
  max_hot_path_latency_ms: number
```

---

## 1.5 Trust Score 不降低固有风险，只降低摩擦

### v4.1 风险模型

```text
inherent_risk = f(operation, domain, data_class, blast_radius, reversibility)
automation_mode = f(trust_score, domain_cap, policy)
approval_policy = f(inherent_risk, automation_mode, org_policy)
```

### 禁止行为

```text
trust_score 不得降低 inherent_risk。
trust_score 不得绕过合规审批。
trust_score 不得放宽数据分级、egress、sandbox、budget hard cap。
```

---

# 2. Critical 问题整改

## C1. OAPEFLIR 与 Harness 双模型冗余

**整改等级**：P0 / 必须修复  
**整改动作**：

1. §13 改名为 **OAPEFLIR 受控认知框架**。
2. §45 改名为 **Harness Runtime 权威执行模型**。
3. 删除 OapeflirRun 作为独立运行实体的描述。
4. 增加 OAPEFLIR → HarnessRun 投影关系表。

**验收标准**：

- 文档中只有 HarnessRun 是权威 Run。
- OAPEFLIR 状态不再驱动执行。
- OAPEFLIR 只作为 StageRationale / TraceProjection / Audit View。

---

## C2. 落地路线时间不现实

**整改等级**：P0 / 必须修复  
**整改动作**：

将路线图改为三环模型：

| 环 | 周期 | 目标 |
|---|---:|---|
| Survival Ring | 8-12 周 | 最小生产闭环 |
| Hardening Ring | 12-24 周 | 恢复、审计、HITL、SideEffect、Budget |
| Enterprise Ring | 24 周以后 | 多 Region、生态、垂直域、多模态 |

### MVP 只包含

```text
P1 最小入口
HarnessRuntime 最小闭环
PlanGraph DAG
ToolExecutor
State Store + Event Log
Budget 原子预留
SideEffect proposed / committed
HITL 基础审批
Trace Replay
CLI / Console inspect
```

### MVP 不包含

```text
多 Region
Marketplace
24 垂直域
Edge Runtime
PlatformOps Agent
完整 Evaluation Harness
完整组织治理
完整多模态
完整合规报告
```

---

## C3. 手动故障转移与 99.99% SLA 矛盾

**整改等级**：P0 / 必须修复  
**整改动作**：

v4.1 阶段采用保守承诺：

```text
手动 / 半自动 failover 最高只能承诺 99.95%。
99.99% 只能在 automatic failover + quorum + warm standby 完成后开放。
```

### SLA 修订

| Tier | v4.1 可用性 |
|---|---:|
| Platinum | 99.95% |
| Gold | 99.9% |
| Silver | 99.5% |
| Bronze | best effort |

---

## C4. 全局调用深度上限矛盾

**整改等级**：P0 / 必须修复  
**整改动作**：

```text
Goal decomposition max depth = 5
Delegation chain max depth = 3
Global call depth hard cap = 8
```

规则：

```text
global_call_depth 每跨一次 decompose / delegate / subgraph +1。
超过 8 立即拒绝。
局部上限不可相乘作为许可上限。
```

---

## C5. 表数量膨胀无约束

**整改等级**：P0 / 必须修复  
**整改动作**：按 Phase 裁剪表。

### Phase 1 MVP：18 张表

```text
tenant
principal
task
harness_run
harness_step
plan_graph
node_run
event_log
event_outbox
artifact_record
tool_definition
tool_call
side_effect
budget_ledger
decision_record
approval_request
checkpoint
idempotency_record
```

### Phase 2 Hardening：追加 14 张表

```text
execution_lease
worker
dlq_record
incident
recovery_job
reconciliation_job
compensation_record
audit_record
projection_rebuild_job
config_version
prompt_version
model_provider
usage_record
health_snapshot
```

其余表进入 Enterprise Ring。

---

## C6. 跨区域冲突解决策略未定义

**整改等级**：P0 / 必须修复  
**整改动作**：

v4.1 不承诺 active-active writes。

```text
single-leader per partition
follower reads
async replication
controlled failover
```

### 硬规则

```text
CAS + Lease + Fencing 只在 partition leader 内有效。
Follower region 不接受 truth writes。
Failover 后生成新的 fencing epoch。
旧 leader 恢复后必须作为 follower 加入。
```

---

## C7. LLM Agent 与超低延迟域不兼容

**整改等级**：P0 / 必须修复  
**整改动作**：

增加双模式执行：

```text
LLM-assisted planning
compiled deterministic execution
```

示例：

```yaml
domain_id: quant-trading
planning_mode: llm_assisted
hot_path_mode: deterministic_only
llm_in_hot_path_allowed: false
max_hot_path_latency_ms: 10
```

---

## C8. Replay 确定性假设不可实现

**整改等级**：P0 / 必须修复  
**整改动作**：

§58.4 改为：

```text
Trace Replay：重放记录的事件、LLM 输出、Tool 输出、Scheduler 决策。
Re-execution Replay：重新执行，非确定性，只用于仿真。
```

新增事件：

```text
llm.response.recorded
tool.output.recorded
scheduler.decision.recorded
decision.bundle.frozen
```

---

## C9. Budget 预检 TOCTOU

**整改等级**：P0 / 必须修复  
**整改动作**：

预算流程改为：

```text
estimate → atomic reserve → execute → settle actual → release unused
```

原子预留：

```sql
UPDATE budget_ledger
SET reserved = reserved + :estimate
WHERE subject_id = :tenant_id
  AND used + reserved + :estimate <= limit;
```

---

## C10. Trust Score 权限提升路径

**整改等级**：P0 / 必须修复  
**整改动作**：

删除 `trust_score lowers risk_score`。

Trust score 只能影响：

```text
审批队列优先级
低风险任务抽检比例
提示频率
人工确认摩擦
```

不能影响：

```text
固有风险等级
合规审批要求
不可逆动作控制
数据分级
sandbox / egress / budget hard cap
```

---

# 3. Consistency 问题整改

| 编号 | 问题 | v4.1 整改 |
|---|---|---|
| S1 | P95 / P99 不一致 | SLA 对外用 P95，SLO 内部用 P99，字段拆成 `maxLatencyP95ForSLA` / `maxLatencyP99ForSLO` |
| S2 | Phase 6 双重映射 | D1+S1=Phase1，D2+S2=Phase2-3，D3+S3=Phase4-5，S4=Phase6+ |
| S3 | 双错误码命名空间 | 统一为 `PLATFORM.{plane}.{domain}.{category}.{specific}` |
| S4 | §58.7-§58.8 缺失 | 补齐 §58.7 Metrics、§58.8 Incident Rules、§58.9 Error Code |
| S5 | Appendix H 引用不存在子节 | 删除本地编号引用，Appendix H 自洽编号 |
| S6 | Batch B/C 与 Phase 不一致 | Batch A-D 重新映射到新三环模型 |
| S7 | 审批矩阵仅 CNY | 增加 base currency、FX snapshot、amount_in_base_currency |
| S8 | Harness run SLO 循环定义 | 增加默认 SLO：Platinum 10s / Gold 30s / Silver 5min / Bronze 30min |

---

# 4. Design Flaw 问题整改

## F1. SideEffect 状态机缺撤回路径

新增状态：

```text
approved → revoked
approved → expired
approved → committing
```

commit 前重新验证：

```text
approval still valid
budget still reserved
policy version compatible
risk signal unchanged or accepted
operator scope still valid
```

---

## F2. Graph Scheduler Replay 不确定

记录实际调度事件：

```text
scheduler.ready_set_computed
scheduler.node_selected
scheduler.worker_selected
scheduler.dispatch_committed
```

Replay 时重放事件，不重新推导 worker 选择。

---

## F3. Outbox Poller 故障转移间隙

新增配置：

```text
lease_ttl_seconds ≤ 10
heartbeat_interval_seconds ≤ 3
hot_standby_pollers ≥ 1
event_delivery_gap_p99 ≤ 10s
```

---

## F4. Budget Ledger 租户级热点

Phase 1 使用单行原子预留。  
Phase 3 引入：

```text
budget_sub_ledger
reservation_bucket
local quota lease
periodic reconciliation
hard limit watcher
```

---

## F5. RunVersionLock 与 GraphPatch 冲突

新增 `VersionLockOverridePolicy`：

| 策略 | 说明 |
|---|---|
| inherit_lock | GraphPatch 必须使用原版本 |
| compatible_minor_only | 只允许兼容 minor 版本 |
| explicit_override | 可突破锁，但必须 HITL + Evidence + Replay Isolation |
| force_restart | 不允许 patch，必须新建 run |

默认：

```text
low / medium = compatible_minor_only
high / critical = inherit_lock
```

---

## F6. Memory 六层驱逐策略

新增 `ContextEvictionPolicy`：

| 优先级 | 层 | 行为 |
|---:|---|---|
| 1 | working | 不驱逐，只压缩 |
| 2 | procedural | 不驱逐，只摘要 |
| 3 | semantic | 保留高 trust / relevance |
| 4 | session | 可摘要 |
| 5 | episodic | 优先驱逐或摘要 |
| 6 | meta | 仅必要时注入 |

---

## F7. ControlDirective 混淆运维与业务决策

拆分：

```text
OperationalDirective:
  pause / resume / kill / rollback / mode_switch / quota_adjust

DecisionDirective:
  approve / deny / request_changes / delegate / revoke
```

---

## F8. 语义缓存实际为句法缓存

v4.1 改名为：

```text
Exact Prompt Cache
```

真正语义缓存进入后续阶段，必须定义：

```text
embedding model
similarity threshold
semantic collision guard
data class eligibility
unsafe domain disable list
```

---

## F9. 部分响应接受阈值不可靠

删除“80% 预期长度”启发式。

改为格式感知完整性检查：

| 输出类型 | 检查 |
|---|---|
| JSON | parse + schema validate |
| PlanGraph | entry / terminal / valid DAG |
| SQL | parser + safety lint |
| Code | compile / typecheck / tests |
| Report | required sections complete |

---

## F10. 协作协议缺消息排序和状态机

新增 Delegation 状态机：

```text
created → offered → accepted / rejected
accepted → running → completion_reported → verified → closed
accepted → running → failed → retry / closed
```

消息字段：

```text
conversationId
delegationId
seq
causationId
expectedPreviousSeq
```

---

## F11. LLM-as-Judge 降级不可用

新增降级规则：

| 降级级别 | Quality Gate 行为 |
|---|---|
| D0 | 正常 |
| D1 | canary 暂停晋升 |
| D2 | 禁止新 canary，已有 canary hold |
| D3 | 只允许 deterministic eval |
| D4 | 全部 rollout 暂停 |

---

## F12. 休眠工作流唤醒后描述符不兼容

Checkpoint 必须包含：

```text
domainDescriptorVersion
policyBundleVersion
promptBundleVersion
toolRegistryVersion
```

唤醒时：

```text
compatible → resume
minor compatible → resume_supervised
breaking change → recovery_needed
```

---

## F13. 协作编辑无并发模型

v4.1 默认采用：

```text
Token Turn-taking
```

后续可扩展：

```text
Branch + Merge
CRDT / OT
```

---

## F14. Crypto-Shredding 打断审计链

跨租户审计记录拆分：

```text
PII payload encrypted by tenant DEK
audit envelope stores non-PII digest
cross-tenant summary stores neutral hash / metadata
```

DEK 销毁后仍保留：

```text
event_id
timestamp
operation_type
tenant_pair_hash
policy_outcome
```

---

## F15. Domain 知识冲突策略未验证

定义闭合枚举：

```text
timestamp_latest
source_priority
human_review
jurisdiction_priority
version_highest
citation_count_priority
```

自定义策略必须实现：

```text
ConflictResolver plugin
```

并在 Gate 1 验证。

---

## F16. PromptBundle Canary 与长任务冲突

新增：

```text
bundle_revocation
```

规则：

```text
canary rollback 时通知 in-flight workflow。
下一个 checkpoint 必须执行 bundle compatibility check。
critical bug bundle 可强制 pause / switch stable / abort。
```

---

## F17. 单人模式自审批架空风控

Solo 高风险操作增加补偿控制：

```text
强制 dry-run
风险预览
冷却期
自动回滚窗口
二次确认
高危动作建议外部 reviewer
```

---

## F18. Context Token Budget 从 Cost Budget 推导错误

ConstraintPack 拆分：

```yaml
budget:
  max_cost
  max_model_tokens
  max_context_tokens
  max_output_tokens
  max_steps
  max_duration_ms
```

---

## F19. 域风险评分跨域未校准

新增风险校准框架：

| 分数段 | 含义 |
|---|---|
| 90-100 | 人身安全、刑事责任、重大监管处罚、不可逆法律后果 |
| 80-89 | 重大财务损失、生产事故、重大隐私泄露 |
| 60-79 | 可恢复但影响较大的业务 / 法务 / 品牌风险 |
| 40-59 | 中等业务风险，需要抽检或条件审批 |
| 0-39 | 低风险，自动化优先 |

每个领域覆写分数必须说明校准依据。

---

## F20. Proactive Trigger 与用户任务共享预算池

新增预算分区：

```text
user_initiated_reserved_budget ≥ 60%
proactive_trigger_budget ≤ 40%
```

触发器预算耗尽后：

```text
auto_execute → suggestion → silent_record
```

---

## F21. 多 Agent Working Memory 作用域不清

Working Memory 分角色段：

```text
working_memory.shared_readonly
working_memory.planner_private
working_memory.generator_private
working_memory.evaluator_private
working_memory.controller_private
```

每个角色有显式读写权限。

---

## F22. Trust Score 衰减断崖效应

改为连续衰减：

```text
score(t) = score_0 * exp(-lambda * inactive_days)
```

当分数自然穿越层级边界时降级。降级前 7 天预警。

---

## F23. Guardrails 五层冲突解决

定义裁决优先级：

```text
abort > quarantine > revoke > escalate > replan > filter > redact > allow
```

增加每 run 限制：

```text
max_guardrail_cycles = 3
```

超过直接 escalate / abort。

---

## F24. Evaluator 和 Generator 共模失效

新增 `model_independence_policy`：

| 风险 | 要求 |
|---|---|
| low | same_model allowed |
| medium | different_model preferred |
| high | different_model required |
| critical | different_provider required |

---

## F25. PlatformPanicDirective TTL 自动过期危险

改为：

```text
panic 默认 indefinite。
ttl 到期只触发 re-confirmation，不自动解除。
解除 panic 必须 PlatformResumeDirective + 双人审批。
```

---

## F26. 跨区域 LLM 路由与数据驻留

跨境 LLM 调用增加：

```text
input PII scan
output PII scan
transfer mechanism check
output quarantine if PII generated
incident report if residency violated
```

---

## F27. Starvation Prevention 导致优先级崩溃

将离散升级改为权重老化：

```text
effective_priority = base_priority + aging_factor(wait_time)
```

并限制：

```text
per-tenant auto-promotion budget
global promoted ratio threshold
```

超过阈值触发容量告警。

---

## F28. 边缘 SideEffect 队列无依赖预验证

SyncQueue 增加：

```text
side_effect_id
depends_on[]
conflict_policy
topological_order
```

提交时：

```text
按拓扑序提交
父 side effect 失败则子链中止
生成 conflict incident
```

---

## F29. Agent 生命周期缺 testing / staging 回退

状态机改为：

```text
draft ↔ testing ↔ staging → canary → active
```

允许：

```text
testing → draft
staging → draft
```

保留版本谱系和失败原因。

---

## F30. Knowledge Trust Level 无降级路径

新增状态：

```text
private_unverified
team_reviewed
official
authoritative
contested
under_review
retired
```

降级流：

```text
authoritative → contested → under_review → re_promoted / retired
```

---

## F31. CAS + Lease + Fencing 三重检查写放大

### 问题

每次 NodeRun 状态转移都需要 CAS + Lease + Fencing，PlanGraph 并发节点多时 truth table 成为写热点。

### v4.1 整改

1. **按 runId 分区 truth table**：

```text
node_run partition by run_id_hash
execution_lease partition by run_id_hash
```

2. **CAS 重试策略**：

```text
max_cas_retries = 3
backoff = exponential + jitter
base = 10ms
max = 250ms
```

3. **Scheduler tick 批处理**：

```text
同一 run 内同一 tick 的多个 ready/completed 状态转移可批量提交。
批处理必须仍保持单节点幂等状态转移。
```

4. **写热点检测指标**：

```text
truth.write_conflict_rate
truth.cas_retry_count
truth.partition_hotspot
```

---

## F32. Webhook 50 次失败阈值缺退避规范

### v4.1 整改

定义 Webhook retry policy：

| 错误类型 | 示例 | 策略 |
|---|---|---|
| transient | 500 / timeout / 503 | 指数退避，最多 50 次 |
| rate_limit | 429 | 尊重 Retry-After，最大间隔 1h |
| permanent | 400 / 401 / 403 / 404 | 最多 10 次或立即禁用 |
| signature_error | 401 signature mismatch | 立即暂停并告警 |

默认退避：

```text
1s, 2s, 4s, 8s ... max 15min
jitter ±20%
```

---

## F33. Budget 预留无超时或死锁防护

### v4.1 整改

BudgetReservation 增加状态机：

```text
reserved → settled
reserved → released
reserved → expired
reserved → cancelled
```

字段：

```text
reservation_id
subject_id
amount_estimated
amount_actual
ttl_seconds
expires_at
node_id
run_id
```

规则：

```text
节点失败 / 超时自动 release。
reservation TTL 到期自动 expire。
Graph 并行节点必须先做 budget arbitration。
```

并行预算仲裁：

```text
parallel_budget_pool = min(run_remaining_budget, branch_budget_sum)
branches 按 priority / risk / dependency 分配 reservation。
无法全部满足时：低优先级 branch 延迟或降级。
```

---

# 5. Over-Engineering 问题整改

## O1. 行为漂移检测过度复杂

### 整改

Phase 1-5 只保留简单阈值：

```text
success_rate_drop
cost_spike
tool_usage_change
human_override_rate
incident_count
```

高级算法延后：

```text
CUSUM / Bayesian changepoint / KL divergence → Phase 6+
```

---

## O2. 工作流调试器过于激进

### 整改

拆分为三层：

| 层 | 能力 | 阶段 |
|---|---|---|
| Debug Lite | timeline + trace + inspect | MVP / Phase 2 |
| Debug Pro | replay + compare | Phase 4+ |
| Debug IDE | breakpoint / watchpoint / step-into | Phase 7+ |

MVP 不做 IDE 级调试器。

---

## O3. 24 域深化内容模板化

### 整改

主文档只保留：

```text
Domain Meta-Model
DomainRecipe
2 个示例域：coding / financial-services
24 域完整规格移入 docs_zh/domains/
```

主文档避免堆叠领域常识。

---

## O4. 60+ 硬约束同时执行过重

### 整改

硬约束拆为三类：

| 类型 | 执行方式 |
|---|---|
| Runtime Invariant | 机器强制，违反即失败 |
| Policy Rule | 策略引擎执行，可审批 |
| Governance Requirement | 组织流程执行，可审计 |

---

## O5. 123 ADR 前置冻结

### 整改

ADR 按 Phase 冻结：

| ADR 组 | 冻结时机 |
|---|---|
| Runtime Core ADR | Phase 0 |
| State / Budget / SideEffect ADR | Phase 1 |
| Recovery / HITL / Replay ADR | Phase 2 |
| Org / Compliance ADR | Phase 4 |
| Domain ADR | 对应 domain onboarding 前 |
| Multi Region ADR | Phase 5 前 |

---

# 6. 架构缺口整改

## G1. 无数据迁移策略

新增章节：**Schema Migration & Storage Evolution**

必须定义：

```text
online additive migration
dual-write migration
backfill job
read path switch
rollback script
migration audit record
```

SQLite → PostgreSQL 迁移路径：

```text
export snapshot
verify checksum
import PG
dual-write window
shadow-read compare
cutover
rollback window
```

---

## G2. 无平台自身测试策略

新增章节：**Platform Test Strategy**

测试分层：

```text
unit
contract
integration
E2E
replay test
chaos test
load test
security test
migration test
domain pack certification test
```

关键验收：

```text
HarnessRun contract test
PlanGraph scheduler test
Budget atomic reserve test
SideEffect reconciliation test
Panic drill test
Trace Replay determinism test
```

---

## G3. 边缘设备安全模型缺失

新增 Edge Security：

```text
device identity
secure boot
disk encryption
local secret vault
remote wipe
attestation
offline action risk ceiling
sync queue signing
tamper detection
```

设备被盗策略：

```text
revoke device certificate
invalidate sync queue
remote wipe if online
force re-enrollment
```

---

## G4. 自运维 Agent 循环依赖

整改：

```text
PlatformOps Agent 不能作为唯一恢复路径。
必须保留 external break-glass runbook。
关键故障恢复依赖人工 CLI / infra control plane。
```

---

## G5. 多模态与约束集成缺失

多模态接入 Harness：

```text
ContentPart 进入 ContextAssembly
每种 modality 独立 Guardrails
多模态 prompt bundle 版本化
artifact reference 不内联二进制
image/audio/video 输出进入 Output Guardrails
```

---

## G6. 五平面归属模糊

整改：

| 组件 | 归属 |
|---|---|
| ModelGateway | 独立 AI Operations Service，被 P3/P4 调用，受 X1 middleware 管控 |
| X1 | 横切能力，不作为业务服务 |
| Learn / Improve | Async Intelligence Jobs，归 P3/P5/P2 联合治理 |
| Release | P2 Control Plane |

---

## G7. Prompt Injection 防御可行性

整改：

```text
ML classifier 不是唯一防线。
v4.1 默认采用规则 + boundary + tool isolation + output validation。
classifier 阈值仅作为风险信号。
```

需要定义：

```text
eval dataset
red-team suite
false positive target
false negative target
update cadence
```

---

## G8. super_admin 与不可侵犯护栏矛盾

整改：

```text
super_admin 可修改 policy，但不能修改 runtime invariant。
runtime invariant 只能通过 signed release + ADR + CI verification 改变。
```

不变量示例：

```text
Trace Replay 不产生 SideEffect
High risk must have approval or explicit deny
Secret never enters Memory
CAS / fencing required for truth writes
```

---

# 7. 运营与治理缺陷整改

## V1. Peer 委托缺利益冲突检查

新增 `ConflictOfInterestFilter`：

```text
same requester team?
same project financial interest?
recent collaboration?
direct reporting relation?
prior approval chain conflict?
```

Peer 委托必须标记：

```text
delegated_approval = true
delegation_reason
conflict_check_result
```

---

## V2. Chinese Wall 无重置机制

新增 `WallExpiryPolicy`：

```text
transaction_closed
cooling_period_elapsed
compliance_officer_approval
audit_record_complete
```

解除后保留完整审计。

---

## V3. Marketplace Removed 无迁移保障

新增 removed 前置条件：

```text
active_installations < threshold
or migrated_installations ≥ 80%
or security_emergency = true
```

关键 Pack 必须提供：

```text
migration guide
replacement mapping
data export
compatibility shim
```

---

## V4. Few-Shot Harvesting 无偏差防护

新增：

```text
diversity_score
domain_coverage_score
team_distribution_check
negative_case_balance
```

覆盖度不足时：

```text
auto harvest → review required
```

---

## V5. Panic 传播无部分失败处理

新增 PanicAcknowledgment 协议：

```text
directive_id
plane
status: acknowledged | failed | timeout
local_stop_state
timestamp
evidence_ref
```

未确认处理：

```text
panic_incomplete incident
infra-level kill
network isolation
credential revocation
```

---

## V6. 部门合并缺域冲突解决

新增 Org Merge Conflict Report：

```text
risk policy conflict
approval route conflict
pack duplicate
budget overlap
knowledge boundary conflict
domain owner conflict
```

默认策略：

```text
策略冲突取严格者。
重复 Pack 手动指定 survivor。
知识边界默认不合并。
合并前必须管理员确认冲突报告。
```

---

# 8. 路线图与落地问题整改

## R1. 并发跳跃无验证

新增中间目标：

| 阶段 | 并发目标 |
|---|---:|
| Phase 1 | 10 |
| Phase 2 | 50 |
| Phase 3 | 200 |
| Phase 4 | 500 |
| Phase 5 | 1000 |

每阶段必须有 load profile：

```text
short run
long run
high fanout graph
approval wait
tool timeout
llm slow
budget contention
```

---

## R2. Phase 9 全 24 域 GA 单一门控

改为逐域 GA：

```text
platform milestone = N/24 domains GA
domain milestone = each domain independent GA
```

建议：

```text
Phase 9a: 4/24
Phase 9b: 8/24
Phase 9c: 12/24
Phase 9d: 16/24
Phase 9e: 20/24
Phase 9f: 24/24
```

但每个域不阻断其他域价值交付。

---

## R3. 风险列表无排序

新增 Risk Register：

字段：

```text
risk_id
severity
likelihood
impact
owner_team
mitigation
linked_adr
status
review_date
```

---

## R4. 硬约束混淆不变量与策略

拆分：

```text
Platform Runtime Invariants
Governance Policies
Domain Compliance Requirements
Operational Runbooks
```

每项标注：

```text
enforcement: runtime | policy_engine | CI | human_process | audit
```

---

## R5. Three-Ring 模型与 Phase 8 依赖冲突

整改：

```text
Ring 只作为沟通模型，不作为调度模型。
真实调度以 Dependency DAG 为准。
```

或重画 Ring 为依赖闭合集。

推荐：删除 Ring 中 Phase 8 特殊跨环说法，统一放入依赖图。

---

## R6. state-evidence 模块标记计划中但被硬依赖

整改：

```text
incident/
checkpoints/
dlq/
```

如果 Phase 2-3 依赖它们，则不能标记为“计划中”。  
改为：

```text
MVP required
Hardening required
Enterprise optional
```

---

## R7. OAPEFLIR 双路径目录

唯一规范路径：

```text
src/platform/orchestration/oapeflir/
```

若已有：

```text
src/platform/oapeflir/
```

则只保留 re-export barrel，并标记 deprecated。

---

## R8. Canonical Domain Meta-Model 无版本化

新增：

```text
cdm_version
supported_versions
migration_policy
deprecation_window
```

示例：

```yaml
cdm_version: cdm-v1
compatible_until: 2027-01-01
migration_required: false
```

---

# 9. 文档结构问题整改

## D1. 文档体量过大

拆分文档：

```text
00-platform-architecture-core.md          # 核心架构，目标 3000 行以内
01-runtime-harness-oapeflir.md            # Harness / OAPEFLIR
02-state-evidence-consistency.md          # 状态、一致性、Replay
03-ai-operations.md                       # ModelGateway / Prompt / Eval / Cost
04-domain-onboarding-framework.md         # 领域接入框架
domains/*.md                              # 24 域规格
05-operations-governance.md               # 组织、合规、运维
06-roadmap.md                             # 路线图
07-adr-index.md                           # ADR 索引
```

---

## D2. 章节编号不连续

v4.1 保留历史编号作为锚点，但新增“阅读编号”：

```text
Part 1 / Chapter 1
Legacy ref: §45
```

---

## D3. 本地路径泄露

删除所有：

```text
/Users/...
/home/...
local absolute path
```

替换为仓库相对路径：

```text
docs_zh/architecture/...
```

---

## D4. Appendix H 冲突规则自相矛盾

新增权威顺序：

```text
1. Executable Spec
2. Contract Schema
3. ADR
4. Core Architecture
5. Domain Spec
6. Example / Appendix
```

“更严格者为准”只适用于安全 / 风险 / 合规策略，不适用于结构冲突。结构冲突以 Executable Spec 为准。

---

# 10. v4.1 必须新增的关键章节

## 10.1 §13 — OAPEFLIR 受控认知框架

必须包含：

```text
定位：语义框架，不是执行引擎
八阶段职责
与 HarnessRun 的映射
StageRationale
PlanGraph 作为 Plan 输出原则
OapeflirTraceProjection
```

---

## 10.2 §14 — Runtime Execution Plane 修订

必须包含：

```text
Graph Scheduler
NodeRun 状态机
Scheduler decision events
CAS retry policy
Batch node transition
Worker selection evidence
```

---

## 10.3 §18 — Budget 原子预留模型

必须包含：

```text
BudgetReservation 状态机
Atomic reserve SQL 语义
TTL / release / expire
Parallel branch arbitration
Budget sharding roadmap
```

---

## 10.4 §25 — 一致性与多 Region 写入边界

必须包含：

```text
single-leader per partition
fencing epoch
follower reads
no active-active truth writes
CRDT only for non-critical aggregate
```

---

## 10.5 §28 / §58 — Replay 语义

必须包含：

```text
Trace Replay
Re-execution Replay
Recorded LLM output
Recorded Tool output
Recorded Scheduler decision
Replay side-effect ban
```

---

## 10.6 §45 — Harness 权威运行时

必须包含：

```text
HarnessRun canonical state machine
HarnessStep / NodeRun
PlanGraphBundle
ConstraintPack
Toolbelt
ContextAssembly
Evaluator
Guardrails conflict policy
HITL Runtime
```

---

## 10.7 §60 — Panic 协议

必须包含：

```text
panic indefinite by default
PanicAcknowledgment
panic_incomplete
infra-level kill escalation
resume requires explicit approval
```

---

# 11. v4.1 优先级整改列表

## P0 — 立即修复

| 编号 | 主题 |
|---|---|
| C1 | OAPEFLIR / Harness 权威模型 |
| C2 | MVP 路线重切 |
| C3 | SLA 与 failover 对齐 |
| C6 | 多 Region single-leader 约束 |
| C8 | Replay 语义重定 |
| C9 | Budget atomic reserve |
| C10 | Trust 不降低风险 |
| F1 | SideEffect 撤回 / 过期 |
| F23 | Guardrails 冲突规则 |
| F25 | Panic 不自动解除 |
| G8 | super_admin 不可改 invariant |
| D3 | 删除本地路径 |

---

## P1 — v4.1 必须修复

| 编号 | 主题 |
|---|---|
| C4 | global_call_depth |
| C5 | 表裁剪 |
| C7 | 双模式执行 |
| F2 | Scheduler Replay |
| F3 | Outbox lease |
| F5 | VersionLockOverride |
| F11 | Judge 降级 |
| F12 | Hibernation version snapshot |
| F18 | max_context_tokens |
| F24 | model independence |
| F31 | truth table 写热点 |
| F32 | webhook retry |
| F33 | budget reservation TTL |
| G1 | migration strategy |
| G2 | testing strategy |
| R1 | 并发阶段化 |
| R4 | 硬约束分类 |

---

## P2 — 可进入 Hardening Ring

| 编号 | 主题 |
|---|---|
| F4 | Budget sharding |
| F6 | Memory eviction |
| F10 | Delegation state machine |
| F13 | Collaboration edit model |
| F14 | Crypto-shredding audit envelope |
| F15 | ConflictResolver |
| F16 | Bundle revocation |
| F19 | Risk calibration |
| F20 | Trigger budget partition |
| F21 | Multi-agent working memory |
| F22 | Continuous trust decay |
| V1-V6 | 治理补强 |
| R2-R8 | 路线图修正 |

---

## P3 — 延后 / 降级复杂度

| 编号 | 主题 |
|---|---|
| O1 | 高级漂移检测 |
| O2 | IDE 级调试器 |
| O3 | 24 域主文档堆叠 |
| O4 | 60+ 硬约束全部强制 |
| O5 | 123 ADR 一次性冻结 |
| G3 | Edge 完整安全模型 |
| G5 | 多模态深度治理 |
| D1 | 文档拆分持续优化 |
| D2 | 编号体系优化 |

---

# 12. 建议 v4.1 目录结构

```text
docs_zh/architecture/
  00-platform-architecture-core.md
  01-oapeflir-harness-runtime.md
  02-state-evidence-consistency.md
  03-ai-operations.md
  04-domain-onboarding-framework.md
  05-operations-governance.md
  06-roadmap.md
  07-adr-index.md
  reviews/
    platform-architecture-v4-review-remediation.md
  domains/
    coding.md
    financial-services.md
    healthcare.md
    ...
```

---

# 13. v4.1 成功标准

v4.1 不是以“能力更多”为成功标准，而是以“权威模型更少、硬语义更清楚、MVP 更可落地”为成功标准。

必须满足：

1. **只有一个权威 Run 模型**：HarnessRun。
2. **PlanGraph 是唯一 Plan 执行结构**。
3. **Trace Replay 明确确定，Re-execution Replay 明确非确定**。
4. **Budget 使用 atomic reserve，不再存在 TOCTOU**。
5. **Trust 不再降低固有风险**。
6. **多 Region 不再承诺未定义 active-active writes**。
7. **Panic 不会因 TTL 自动解除**。
8. **SideEffect 有 revoke / expire / reconcile / compensate 路径**。
9. **MVP 表集和 Phase 表集明确**。
10. **24 域从主文档移出，主文档回归平台架构核心**。
11. **硬约束按 Runtime Invariant / Policy / Governance 分层**。
12. **每个 P0 / P1 整改项都有章节落点和验收标准**。

---

# 14. 最终建议

v4.1 应该定位为：

> **“OAPEFLIR-Harness 收敛版 + 最小生产闭环版”**

而不是继续扩展为 v4.0 的更大版本。

v4.1 的优先级顺序应为：

```text
先收敛权威模型
再补齐生产硬语义
再裁剪 MVP
再修正路线图
最后再恢复企业扩展能力
```

如果继续在 v4.0 基础上堆叠垂直域、Marketplace、Edge、多模态、自运维等能力，平台会继续膨胀，但核心执行语义仍不稳定。  
因此，v4.1 最重要的动作是“减法 + 定义权威边界”。

---
