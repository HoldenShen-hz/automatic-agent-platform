# 架构设计 vs 实现状态全面审查报告
automatic_agent/automatic-agent-platform-main/docs_zh/reviews/architecture-design-vs-implementation-review.md
> **版本**: v1.0
> **审查对象**: `docs_zh/architecture/00-platform-architecture.md` v2.7（6,689 行，70 节 §1-§70）
> **审查日期**: 2026-04-20
> **审查范围**: 全部 70 节逐节对比代码库实际实现，识别未实现模块、问题模块，并提供详细解决方案

---

## 目录

- [一、平台基础设施层 §1-§9](#一平台基础设施层-19)
- [二、核心功能层 §10-§23](#二核心功能层-1023)
- [三、基础设施与领域层 §24-§38](#三基础设施与领域层-2438)
- [四、上层交互与生态层 §39-§69](#四上层交互与生态层-3969)
- [五、总结与优先级矩阵](#五总结与优先级矩阵)

---

## 一、平台基础设施层 §1-§9

### §1-§3 概述与愿景

**实现状态**: ✅ 完全对齐

这三节为文档性质（愿景、术语、设计原则），不涉及直接代码实现。代码库的模块组织和命名规范与文档描述一致。

---

### §4 五平面架构（Five Planes + X1 Fabric）

**实现状态**: 🟡 92% 实现

#### P1 接口平面（Interface Plane）— 6/6 组件已实现

| 组件               | 文件位置                                     | 状态    |
| ------------------ | -------------------------------------------- | ------- |
| API Gateway        | `src/platform/interface/api-gateway/`        | ✅ 完整 |
| Webhook Receiver   | `src/platform/interface/webhook-receiver/`   | ✅ 完整 |
| Scheduler          | `src/platform/interface/scheduler/`          | ✅ 完整 |
| Console BFF        | `src/platform/interface/console-bff/`        | ✅ 完整 |
| Ingress Controller | `src/platform/interface/ingress-controller/` | ✅ 完整 |
| Channel Gateway    | `src/platform/interface/channel-gateway/`    | ✅ 完整 |

#### P2 控制平面（Control Plane）— 8/8 组件已实现

| 组件               | 文件位置                                         | 状态    |
| ------------------ | ------------------------------------------------ | ------- |
| Policy Engine      | `src/platform/control-plane/policy-engine/`      | ✅ 完整 |
| Approval Manager   | `src/platform/control-plane/approval-manager/`   | ✅ 完整 |
| Rollout Controller | `src/platform/control-plane/rollout-controller/` | ✅ 完整 |
| Incident Manager   | `src/platform/control-plane/incident-manager/`   | ✅ 完整 |
| Config Manager     | `src/platform/control-plane/config-manager/`     | ✅ 完整 |
| Audit Logger       | `src/platform/control-plane/audit-logger/`       | ✅ 完整 |
| Tenant Manager     | `src/platform/control-plane/tenant-manager/`     | ✅ 完整 |
| IAM Service        | `src/platform/control-plane/iam-service/`        | ✅ 完整 |

#### P3 编排平面（Orchestration Plane）— 5/5 组件已实现

| 组件               | 文件位置                                         | 状态                |
| ------------------ | ------------------------------------------------ | ------------------- |
| OAPEFLIR Engine    | `src/platform/orchestration/oapeflir-engine/`    | ✅ 完整（68+ 文件） |
| Planner            | `src/platform/orchestration/planner/`            | ✅ 完整             |
| Routing Service    | `src/platform/orchestration/routing-service/`    | ✅ 完整             |
| Escalation Manager | `src/platform/orchestration/escalation-manager/` | ✅ 完整             |
| HITL Coordinator   | `src/platform/orchestration/hitl-coordinator/`   | ✅ 完整             |

#### P4 执行平面（Execution Plane）— 4/5 组件已实现

| 组件            | 文件位置                                  | 状态            |
| --------------- | ----------------------------------------- | --------------- |
| Dispatch Engine | `src/platform/execution/dispatch-engine/` | ✅ 完整         |
| Worker Pool     | `src/platform/execution/worker-pool/`     | ✅ 完整         |
| Plugin Executor | `src/platform/execution/plugin-executor/` | ⚠️ **部分实现** |
| Sandbox Runtime | `src/platform/execution/sandbox-runtime/` | ✅ 完整         |
| Lease Manager   | `src/platform/execution/lease-manager/`   | ✅ 完整         |

#### P5 状态与证据平面（State & Evidence）— 8/8 组件已实现

所有 8 个组件（Truth Store, Events, Projections, Artifacts, Memory, Knowledge, Audit Trail, DLQ）均已实现。

#### X1 基础织网（Fabric）— 5/5 组件已实现

AuthN/AuthZ, Sandbox, Circuit Breaker, DLQ, Backpressure 全部实现。

#### 发现的问题

**问题 1: Plugin Executor 实现过于简化**

- 文件 `src/platform/execution/plugin-executor/index.ts` 仅 48 行
- 缺少沙箱隔离机制
- 缺少插件生命周期管理（加载 → 验证 → 执行 → 卸载）
- 缺少资源限制（CPU/内存/超时）

#### 详细解决方案

```typescript
// src/platform/execution/plugin-executor/plugin-executor.service.ts
// 需要扩展为完整的插件执行器，包含：
// 1. 插件加载器 — 从 registry 拉取并验证签名
// 2. 沙箱桥接 — 委托 sandbox-runtime 创建隔离环境
// 3. 资源限制 — CPU/内存/超时配置从 config-manager 获取
// 4. 生命周期钩子 — beforeExecute / afterExecute / onError / onTimeout
// 5. 结果收集 — 标准化输出格式，写入 evidence store

export class PluginExecutorService {
  async execute(
    pluginId: string,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    const manifest = await this.registry.getManifest(pluginId);
    const sandbox = await this.sandboxRuntime.create({
      tier: manifest.sandboxTier,
      limits: {
        cpu: manifest.limits.cpu,
        memory: manifest.limits.memory,
        timeout: manifest.limits.timeout,
      },
    });
    try {
      const plugin = await sandbox.load(manifest.entrypoint);
      await plugin.beforeExecute(context);
      const result = await sandbox.run(plugin, context);
      await plugin.afterExecute(result);
      return result;
    } finally {
      await sandbox.destroy();
    }
  }
}
```

---

### §5 平台契约（Platform Contracts）

**实现状态**: ✅ 100%（7/7 契约已实现）

| 契约             | 位置                                         | 状态    |
| ---------------- | -------------------------------------------- | ------- |
| TaskEnvelope     | `src/platform/contracts/task-envelope/`       | ✅ 已实现 |
| ExecutionResult  | `src/platform/contracts/execution-result/`   | ✅ 已实现 |
| PolicyDecision   | `src/platform/contracts/policy-decision/`     | ✅ 已实现 |
| ApprovalRequest  | `src/platform/contracts/approval-request/`    | ✅ 已实现 |
| AuditEntry       | `src/platform/contracts/audit-entry/`         | ✅ 已实现 |
| EvidenceRecord   | `src/platform/contracts/evidence-record/`     | ✅ 已实现 |
| ProjectionUpdate | `src/platform/contracts/projection-update/`   | ✅ 已实现 |

#### 已完成的修复

**修复 1: EvidenceRecord 和 ProjectionUpdate 实现**

在 `src/platform/contracts/types/platform-contracts.ts` 中新增了完整类型定义和工厂函数：

- `EvidenceRecord` 接口 — 决策证据记录，包含 recordId/traceId/principal/category/targetRef/content/metadata
- `createEvidenceRecord()` 工厂函数
- `ProjectionUpdate` 接口 — 投影更新契约，包含 projectionId/projectionType/version/sourceEvents/patch/metadata
- `createProjectionUpdate()` 工厂函数

新增导出目录：
- `src/platform/contracts/evidence-record/index.ts` — re-export EvidenceRecord 相关类型
- `src/platform/contracts/projection-update/index.ts` — re-export ProjectionUpdate 相关类型

**修复 2: 契约统一导出**

所有契约类型均通过 `contracts/types/platform-contracts.ts` 统一管理，子目录 `index.ts` 仅做 re-export，避免双重定义。

---

### §6 API 端点（REST Endpoints）

**实现状态**: 🔴 15%（3/20 端点完整实现）

这是整个平台 **最薄弱的区域**。

| 端点                  | 状态 | 说明     |
| --------------------- | ---- | -------- |
| GET /tasks            | ✅   | 完整实现 |
| GET /tasks/{id}       | ✅   | 完整实现 |
| POST /tasks           | ❌   | 未实现   |
| DELETE /tasks/{id}    | ❌   | 未实现   |
| PATCH /tasks/{id}     | ⚠️   | 部分实现 |
| GET /executions       | ✅   | 完整实现 |
| GET /incidents        | ⚠️   | 部分实现 |
| POST /incidents       | ❌   | 未实现   |
| GET /packs            | ⚠️   | 部分实现 |
| POST /packs           | ❌   | 未实现   |
| GET /prompts          | ⚠️   | 部分实现 |
| POST /cost-reports    | ❌   | 未实现   |
| GET /webhooks         | ⚠️   | 部分实现 |
| POST /webhooks        | ❌   | 未实现   |
| DELETE /webhooks/{id} | ❌   | 未实现   |
| GET /admin/workers    | ⚠️   | 部分实现 |
| POST /admin/config    | ❌   | 未实现   |
| GET /admin/rollouts   | ⚠️   | 部分实现 |
| GET /admin/tenants    | ❌   | 未实现   |
| GET /admin/budgets    | ❌   | 未实现   |

#### 详细解决方案

需要在 `src/platform/interface/api-gateway/` 中补齐所有 REST 路由。建议按优先级分批实现：

**P0（核心 CRUD）**: POST /tasks, DELETE /tasks/{id} — 任务创建和删除是最基础的操作
**P1（运维可观测）**: POST /incidents, GET /admin/workers, POST /admin/config — 事件响应和运维管理
**P2（生态支撑）**: POST /packs, POST /webhooks, DELETE /webhooks/{id} — 业务包和 Webhook 管理
**P3（治理与合规）**: GET /admin/tenants, GET /admin/budgets, POST /cost-reports — 多租户和成本管理

每个端点应遵循统一模式：

1. 路由注册 → 2. 输入验证（使用现有 contracts 类型）→ 3. 策略检查（委托 policy-engine）→ 4. 业务逻辑 → 5. 审计记录 → 6. 标准响应格式

---

### §7 通信机制

**实现状态**: 🟡 75%（3/4 机制已实现）

| 机制                    | 状态                    |
| ----------------------- | ----------------------- |
| Event Bus（进程内）     | ✅ 已实现               |
| Message Queue（跨服务） | ✅ 已实现               |
| Request/Reply           | ✅ 已实现               |
| Outbox Pattern          | ⚠️ **概念存在但未实现** |

#### 发现的问题

**Outbox Pattern 未实现为独立组件**

- 架构文档要求：事务性 outbox 表 + 异步 poller 确保事件可靠投递
- 实际状态：事件直接发送到 Event Bus，无 outbox 表保证事务一致性

#### 详细解决方案

```typescript
// src/platform/shared/outbox/outbox-poller.service.ts
// 1. 在数据库中创建 outbox 表（event_id, aggregate_type, payload, created_at, published_at）
// 2. 业务写入时同事务写 outbox 行
// 3. Poller 服务轮询 published_at IS NULL 的行，发送到 Event Bus 后标记已发布
// 4. 配置 polling 间隔、批量大小、重试策略
```

---

### §8 可扩展性

**实现状态**: 🟡 67%（4/6 机制已实现）

| 机制                       | 状态      |
| -------------------------- | --------- |
| 水平扩展（Worker Pool）    | ✅        |
| 分区策略（aggregate_type） | ⚠️ 部分   |
| 背压（Backpressure）       | ✅        |
| 缓存层                     | ✅        |
| 队列分区                   | ⚠️ 部分   |
| 自动伸缩策略               | ❌ 未实现 |

#### 详细解决方案

队列分区需要在 dispatch-engine 中按 `aggregate_type` 配置独立消费者组。自动伸缩策略需要根据队列深度和 Worker 利用率触发 HPA 事件。

---

### §9 稳定性七层防护

**实现状态**: ✅ 100% — 全部 7 层已实现

| 层级        | 组件                 | 状态 |
| ----------- | -------------------- | ---- |
| L1 输入验证 | Schema Validation    | ✅   |
| L2 速率限制 | Rate Limiter         | ✅   |
| L3 熔断     | Circuit Breaker      | ✅   |
| L4 隔离     | Bulkhead Isolation   | ✅   |
| L5 超时     | Timeout Manager      | ✅   |
| L6 重试     | Retry with Backoff   | ✅   |
| L7 降级     | Graceful Degradation | ✅   |

这是整个平台实现最完整的区域，无需改进。

---

## 二、核心功能层 §10-§23

### §10 风险控制

**实现状态**: 🟡 80%

风险控制核心逻辑已实现，包括风险评估引擎、策略执行和审批流触发。

#### 发现的问题

- 命名与架构文档不一致：代码使用 `RiskAssessor` 而文档定义 `RiskEvaluationEngine`
- 风险等级枚举缺少 `CRITICAL` 级别（文档定义 4 级：LOW/MEDIUM/HIGH/CRITICAL，代码仅 3 级）
- 风险矩阵配置硬编码，未从 config-manager 动态加载

#### 详细解决方案

1. 统一命名：将 `RiskAssessor` 重命名为 `RiskEvaluationEngine`，更新所有引用
2. 补充 `CRITICAL` 风险等级，对应自动触发 incident + 全面暂停执行
3. 将风险矩阵迁移到 `config/risk/default.json`，通过 config-manager 加载并支持热更新

---

### §11 安全体系

**实现状态**: 🟡 85%

AuthN/AuthZ、沙箱隔离、密钥管理、审计追踪均有实现。

#### 发现的问题

**问题: 沙箱层级缺失第 4 层**

- 架构文档定义 4 层沙箱：`none` / `process` / `container` / `scoped_external_access`
- 代码仅实现 3 层：`none` / `process` / `container`
- `scoped_external_access` 层（允许受控外部 API 调用）完全缺失

#### 详细解决方案

```typescript
// src/platform/execution/sandbox-runtime/tiers/scoped-external-access.ts
// 在 container 沙箱基础上增加：
// 1. 外部 API 白名单 — 从 pack manifest 中读取允许的域名列表
// 2. 出站流量代理 — 所有外部请求经 egress proxy，记录审计日志
// 3. 响应过滤 — 剥离敏感 header，限制响应体大小
// 4. 速率限制 — 对每个外部 API 独立限速

export class ScopedExternalAccessSandbox extends ContainerSandbox {
  private allowedDomains: string[];
  private egressProxy: EgressProxy;

  async validateOutboundRequest(url: string): Promise<boolean> {
    const domain = new URL(url).hostname;
    return this.allowedDomains.includes(domain);
  }
}
```

---

### §12 异常处理

**实现状态**: 🟡 85%

异常恢复、重试策略、DLQ 投递、可观测性告警链路均已实现。

#### 发现的问题

- 异常分类体系基本完整，但缺少 `TransientExternalError` 和 `PermanentExternalError` 的区分
- 异常恢复策略表在代码中硬编码，未做成可配置规则引擎

#### 详细解决方案

1. 在异常类型枚举中增加 `TRANSIENT_EXTERNAL` / `PERMANENT_EXTERNAL` 分类
2. 将恢复策略表迁移到 `config/exception-recovery/default.json`，支持按异常类型×风险等级的矩阵配置

---

### §13 OAPEFLIR 编排引擎

**实现状态**: ✅ 95% — 最强实现区域

68+ 文件覆盖全部 8 个编排阶段：Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Report。

#### 发现的问题

- 仅 `Improve` 阶段的自动优化建议生成为占位实现（返回固定模板）
- 跨阶段的状态转换缺少显式状态机定义

#### 详细解决方案

1. `Improve` 阶段应接入 LLM 生成优化建议，参考历史执行数据和反馈记录
2. 增加显式 FSM（有限状态机）定义，明确每个阶段的合法前驱/后继状态及转换条件

---

### §14 运行时执行

**实现状态**: ✅ 90%

Dispatch Engine、Worker Pool、Lease Manager、心跳机制、任务调度全部实现。

#### 发现的问题

- Worker 的优雅关停（graceful shutdown）逻辑中，当前任务的 checkpoint 保存有竞态窗口
- Lease 续约失败时的任务重分配延迟可达 30s（文档要求 < 10s）

#### 详细解决方案

1. 在 SIGTERM handler 中先暂停接受新任务，等待当前任务 checkpoint 完成后再释放 lease
2. 将 lease TTL 从 30s 缩短到 10s，续约间隔从 10s 缩短到 3s

---

### §15 LLM Provider 管理

**实现状态**: 🟡 75%

Model Gateway 已实现，包括多提供商路由、模型选择、调用抽象层。

#### 发现的问题

**关键缺失: D0-D4 五级降级模型**

- 架构文档定义了 5 级降级策略：
  - D0: 正常（首选模型）
  - D1: 降级（备选模型）
  - D2: 缓存（使用缓存的历史响应）
  - D3: 模板（使用预定义模板响应）
  - D4: 拒绝（返回服务不可用）
- 代码中仅有简单的 fallback 逻辑（D0 → D1），D2-D4 完全缺失

#### 详细解决方案

```typescript
// src/platform/model-gateway/degradation/degradation-controller.ts
export enum DegradationLevel {
  D0,
  D1,
  D2,
  D3,
  D4,
}

export class DegradationController {
  private currentLevel: DegradationLevel = DegradationLevel.D0;

  async route(request: LLMRequest): Promise<LLMResponse> {
    switch (this.currentLevel) {
      case DegradationLevel.D0:
        return this.primaryProvider.call(request);
      case DegradationLevel.D1:
        return this.fallbackProvider.call(request);
      case DegradationLevel.D2:
        return this.responseCache.lookup(request.semanticKey);
      case DegradationLevel.D3:
        return this.templateEngine.render(request.taskType);
      case DegradationLevel.D4:
        throw new ServiceDegradedError("LLM service unavailable");
    }
  }

  // 根据连续失败次数、延迟 P99、错误率自动升降级
  async evaluateHealth(metrics: ProviderMetrics): Promise<void> {
    if (metrics.errorRate > 0.5) this.escalate();
    else if (
      metrics.errorRate < 0.05 &&
      this.currentLevel > DegradationLevel.D0
    )
      this.deescalate();
  }
}
```

---

### §16 Prompt 管理

**实现状态**: 🟡 70%

Prompt Engine 目录存在，基础的 prompt 模板加载和变量替换已实现。

#### 发现的问题

- 缺少 `PromptBundle` 类型（文档定义为 system prompt + user prompt + few-shot examples + constraints 的组合体）
- Prompt 版本管理仅为文件级别，未实现语义化版本号 + A/B 测试分流
- Prompt Registry 为简单 Map 结构，未支持按 domain/task-type 的层级查找

#### 详细解决方案

1. 定义 `PromptBundle` 接口并在 `src/platform/contracts/` 中注册
2. 实现 prompt 版本管理：`v{major}.{minor}` 语义化版本 + traffic split 配置
3. 将 Registry 改为层级结构：`global → domain → pack → task-type`，支持继承和覆盖

---

### §17 模型评估

**实现状态**: 🟡 80%

Evaluation Service 已实现，支持自定义评估指标和批量评估。

#### 发现的问题

- Quality Gate 为桩实现，`evaluate()` 方法直接返回 `{ passed: true }`
- 缺少评估结果到 evidence store 的持久化

#### 详细解决方案

1. Quality Gate 应根据评估指标阈值（从 config 加载）做实际判断
2. 评估结果写入 `src/platform/state-evidence/artifacts/` 作为证据记录

---

### §18 成本管理

**实现状态**: 🟡 70%

Billing 模块存在但位于错误位置。

#### 发现的问题

- Billing 代码位于 `src/scale-ecosystem/` 而非架构文档指定的 `src/platform/control-plane/`
- 缺少实时成本告警（仅有事后统计）
- Token 用量追踪粒度到 task 级别，文档要求到 step 级别

#### 详细解决方案

1. 将计费核心逻辑迁移到 `src/platform/control-plane/billing-service/`，`scale-ecosystem` 保留多区域计费聚合
2. 增加实时成本告警：每次 LLM 调用后累加成本，超阈值触发 `cost.threshold.exceeded` 事件
3. 将 token 追踪粒度从 task 降到 step/execution 级别

---

### §19 Agent 委派

**实现状态**: 🔴 25% — 最薄弱区域

#### 发现的问题

**严重不足**: 仅有一个约 50 行的类型定义文件，无任何运行时逻辑。

缺失内容：

- Agent 拓扑约束（最大深度、扇出限制、循环检测）
- Agent 间协作协议（消息传递、上下文共享、结果聚合）
- 委派上下文安全（权限继承与收窄、沙箱传递）
- 委派链追踪（parent-child 关系、调用栈可视化）

#### 详细解决方案

```typescript
// src/platform/orchestration/agent-delegation/delegation-manager.service.ts
export class DelegationManagerService {
  private readonly MAX_DEPTH = 5;
  private readonly MAX_FANOUT = 10;

  async delegate(
    parent: AgentContext,
    childSpec: DelegationSpec,
  ): Promise<DelegationHandle> {
    // 1. 拓扑检查
    if (parent.delegationDepth >= this.MAX_DEPTH) {
      throw new DelegationDepthExceededError(parent.delegationDepth);
    }
    if (parent.activeDelegations.length >= this.MAX_FANOUT) {
      throw new DelegationFanoutExceededError(parent.activeDelegations.length);
    }
    this.detectCycle(parent, childSpec.targetAgentId);

    // 2. 权限收窄
    const childPermissions = this.narrowPermissions(
      parent.permissions,
      childSpec.requiredPermissions,
    );

    // 3. 上下文隔离
    const childContext = this.createIsolatedContext(
      parent,
      childPermissions,
      childSpec,
    );

    // 4. 创建委派记录
    const handle = await this.truthStore.createDelegation({
      parentId: parent.agentId,
      childId: childSpec.targetAgentId,
      depth: parent.delegationDepth + 1,
      permissions: childPermissions,
      timeout: childSpec.timeout,
    });

    // 5. 分发执行
    await this.dispatchEngine.enqueue(childContext);
    return handle;
  }
}
```

需要新建以下文件：

- `delegation-manager.service.ts` — 委派管理器主逻辑
- `topology-validator.ts` — 拓扑约束（深度/扇出/循环检测）
- `context-isolator.ts` — 上下文安全隔离
- `delegation-tracker.ts` — 委派链追踪和可视化数据结构

---

### §20 长时任务

**实现状态**: ✅ 90%

Hibernation（休眠）和 Checkpoint（检查点）机制完善。

#### 发现的问题

- 检查点的存储格式未标准化，不同 worker 实现可能不兼容
- 缺少检查点大小限制和压缩策略

#### 详细解决方案

1. 定义标准 `CheckpointEnvelope` 格式（version + schema + compressed payload + metadata）
2. 添加 zstd 压缩，检查点上限配置为 10MB

---

### §21 人机协作（HITL）

**实现状态**: 🟡 85%

核心审批流程已实现，支持单人审批和超时升级。

#### 发现的问题

- 缺少多方审批（multi-party approval）：文档要求支持 N-of-M 审批模式
- 审批界面数据缺少上下文摘要生成（审批人需手动查看全部执行日志）

#### 详细解决方案

1. 扩展 ApprovalRequest 支持 `requiredApprovals: number` 和 `approverGroups: string[]`
2. 在审批请求创建时调用 LLM 生成执行摘要，附在审批 payload 中

---

### §22 SDK 体系

**实现状态**: 🟡 75%

| SDK 组件   | 状态 | 说明                  |
| ---------- | ---- | --------------------- |
| CLI        | ✅   | 79 个入口点，功能完整 |
| Pack SDK   | ⚠️   | 最小桩实现            |
| Plugin SDK | ⚠️   | 最小桩实现            |
| Client SDK | ⚠️   | 最小桩实现            |

#### 发现的问题

CLI 是整个 SDK 体系中唯一完整的组件。Pack SDK / Plugin SDK / Client SDK 仅有类型导出和基础脚手架。

#### 详细解决方案

优先补齐 **Pack SDK**（业务包开发者最常用）：

1. `createPack()` — 脚手架生成
2. `validateManifest()` — 清单校验
3. `testLocal()` — 本地沙箱测试
4. `publish()` — 发布到 registry

其次补齐 **Plugin SDK**：

1. `definePlugin()` — 插件定义 DSL
2. `PluginContext` — 运行时上下文注入
3. `PluginTestHarness` — 测试工具

---

### §23 合规体系

**实现状态**: 🟡 70%

基础合规检查、数据擦除、审计追踪已实现。

#### 发现的问题

**关键缺失: 加密销毁（Crypto-shredding）**

- 架构文档要求：使用 DEK（Data Encryption Key）加密个人数据，销毁时只需删除 DEK
- 实际实现：直接擦除数据记录（DELETE 操作），无加密层

这意味着：

- 无法保证已备份/已复制数据的彻底销毁
- 不符合 GDPR 的 "right to be forgotten" 最佳实践

#### 详细解决方案

```typescript
// src/platform/compliance/crypto-shredding/
// 1. DEK 管理器 — 为每个数据主体生成独立 DEK
// 2. 加密拦截器 — 在写入 truth store 前用 DEK 加密 PII 字段
// 3. 销毁服务 — 删除 DEK 即等同于销毁所有用该 DEK 加密的数据
// 4. 密钥轮换 — 定期轮换 DEK，重加密活跃数据

export class CryptoShreddingService {
  async shred(subjectId: string): Promise<ShredResult> {
    const dekId = await this.dekStore.findBySubject(subjectId);
    await this.dekStore.destroy(dekId); // DEK 销毁 = 数据不可恢复
    await this.auditTrail.record({
      action: "crypto_shred",
      subjectId,
      dekId,
      timestamp: new Date().toISOString(),
    });
    return { status: "shredded", dekId };
  }
}
```

---

## 三、基础设施与领域层 §24-§38

### §24 配置治理

**实现状态**: 🟡 60%

Config Manager 存在，支持 JSON 配置加载和环境覆盖。

#### 发现的问题

1. **缺少多层配置体系**: 文档定义 4 层：`platform → tenant → pack → task-type`，代码仅有 `platform` 层
2. **缺少配置变更事件**: 配置更新后不发送 `config.changed` 事件，下游服务无法动态响应
3. **缺少配置金丝雀发布**: 文档要求配置变更支持灰度发布（先 5% → 25% → 100%），代码为全量立即生效

#### 详细解决方案

1. 扩展配置加载逻辑支持 4 层合并：`deepMerge(platform, tenant, pack, taskType)`
2. 在 config-manager 写入操作后发布 `config.changed` 事件到 Event Bus
3. 复用 rollout-controller 的灰度能力，为配置变更增加 `ConfigRolloutStrategy`

---

### §25 数据一致性

**实现状态**: 🟡 80%

Event sourcing 基础和 projection 机制已搭建。

#### 发现的问题

- Projection rebuild（投影重建）仅有方法签名，无完整实现
- 事务保证未显式声明（文档要求 event append + outbox write 在同一事务中）

#### 详细解决方案

1. 实现完整的 projection rebuild：从 event store 全量回放，按 projection handler 重建状态
2. 在 event append 方法中使用数据库事务包裹 event 写入 + outbox 写入

---

### §26 存储层

**实现状态**: 🟡 70%

#### 发现的问题

**关键缺失: 30/71 张表未实现**

已实现 41 张表，缺失 30 张。主要缺失区域：

- 多租户相关：`tenants`, `tenant_quotas`, `tenant_billing`
- 成本管理：`cost_reports`, `budget_alerts`, `token_usage_daily`
- Marketplace：`marketplace_listings`, `pack_reviews`, `pack_downloads`
- Agent 委派：`delegations`, `delegation_events`
- Prompt 管理：`prompt_bundles`, `prompt_versions`, `prompt_ab_tests`

**PostgreSQL 迁移滞后**

- 代码声明支持 PG，但 migration 文件仅覆盖 3 张表（tasks, executions, events）
- 其余 38 张已实现表仅有 SQLite schema

#### 详细解决方案

1. 按优先级分批创建缺失表的 schema：
   - P0: `delegations`, `prompt_bundles`（阻塞 §19 和 §16 的完善）
   - P1: `tenants`, `tenant_quotas`（阻塞多租户功能）
   - P2: 其余 Marketplace 和统计表
2. 使用 migration 工具为所有 41 张已实现表生成 PG migration 脚本
3. 添加 migration CI 检查：每次 schema 变更必须同时提交 SQLite + PG migration

---

### §27 SLO 框架

**实现状态**: 🟡 70%

SLO 定义和度量收集框架已搭建，与 Prometheus 集成。

#### 发现的问题

- 缺少每阶段（OAPEFLIR 8 阶段）的 P99 延迟强制执行
- 缺少 LLM 调用延迟分解（网络延迟 vs 推理延迟 vs token 生成延迟）
- Error budget 计算存在但无自动降级触发

#### 详细解决方案

1. 在 OAPEFLIR 每个阶段入口/出口添加 `stage_duration_seconds` histogram
2. 在 model-gateway 调用链路中记录 `llm_ttfb_seconds`（首 token 延迟）和 `llm_total_seconds`
3. Error budget 耗尽时自动触发 rollout freeze + 通知 on-call

---

### §28 事件与投影

**实现状态**: 🟡 55%

#### 发现的问题

**事件命名空间缺失 9/25**

已实现 16 个命名空间：
`task.*`, `execution.*`, `approval.*`, `policy.*`, `incident.*`, `config.*`, `audit.*`, `worker.*`, `dispatch.*`, `plugin.*`, `rollout.*`, `circuit.*`, `dlq.*`, `backpressure.*`, `lease.*`, `heartbeat.*`

缺失 9 个：
`delegation.*`, `prompt.*`, `cost.*`, `tenant.*`, `pack.*`, `marketplace.*`, `slo.*`, `compliance.*`, `knowledge.*`

**投影缺失 2/9**

- 已实现 7 个投影：TaskSummary, ExecutionTimeline, WorkerStatus, IncidentBoard, PolicyAudit, RolloutProgress, SystemHealth
- 缺失：`CostDashboard`, `DelegationTree`

**DLQ 事件字段不完整**

- 缺少 `original_timestamp`, `failure_category`, `retry_exhausted_at` 字段

#### 详细解决方案

1. 为 9 个缺失命名空间定义事件 schema（在 `src/platform/state-evidence/events/namespaces/`）
2. 实现 `CostDashboard` 和 `DelegationTree` 投影 handler
3. 扩展 DLQ 事件结构，补充 3 个缺失字段

---

### §29 知识与记忆

**实现状态**: 🟡 75%

Knowledge Store 和 Memory 管理已实现，支持向量检索和上下文注入。

#### 发现的问题

- 信任等级命名不一致：文档 `verified/unverified/deprecated`，代码 `high/medium/low`
- 记忆层级命名不一致：文档 `working/episodic/semantic`，代码 `short_term/long_term/persistent`

#### 详细解决方案

统一使用文档定义的命名，添加映射层兼容现有数据：

```typescript
const TRUST_LEVEL_MAP = {
  high: "verified",
  medium: "unverified",
  low: "deprecated",
};
const MEMORY_LAYER_MAP = {
  short_term: "working",
  long_term: "episodic",
  persistent: "semantic",
};
```

---

### §30 业务包（Business Pack）

**实现状态**: 🟡 50%

#### 发现的问题

1. **模型不匹配**: 代码使用 `DomainDefinition` 而文档定义 `BusinessPackManifest`，字段差异显著
2. **生命周期简化**: 文档定义 6 阶段（draft → review → approved → published → deprecated → archived），代码仅 4 阶段（draft → active → deprecated → archived），缺少 `review` 和 `approved`
3. **清单验证不充分**: manifest 校验仅检查必填字段，未检查依赖声明、权限声明、沙箱要求

#### 详细解决方案

1. 定义 `BusinessPackManifest` 接口并从 `DomainDefinition` 迁移
2. 补充 `review` 和 `approved` 两个生命周期阶段，对接 approval-manager
3. 增强清单验证：检查依赖项存在性、权限最小化、沙箱层级合理性

---

### §31 灾难恢复

**实现状态**: 🟡 70%

HA 配置和备份脚本已存在于 `deploy/` 目录。

#### 发现的问题

- 缺少 DR drill 自动化（文档要求每月自动化灾难恢复演练）
- 备份恢复的 RTO/RPO 未验证（无自动化恢复测试）

#### 详细解决方案

1. 在 `deploy/scripts/` 中添加 `dr-drill.sh` 自动化脚本
2. 添加 CI job 每月执行备份恢复验证，记录实际 RTO/RPO

---

### §32 部署策略

**实现状态**: 🟡 80%

| 层级      | 状态        | 说明                        |
| --------- | ----------- | --------------------------- |
| D1 单节点 | ✅ 活跃使用 | Docker Compose 配置完整     |
| D2 集群   | ✅ 就绪     | Helm chart + K8s manifests  |
| D3 多区域 | ⚠️ 设计阶段 | Terraform 模板存在但未验证  |
| 5 环境    | ✅          | dev/staging/preprod/prod/dr |

#### 发现的问题

- D3 多区域部署的数据同步策略未实现（仅有 Terraform 基础设施模板）
- 环境间配置差异管理依赖手动 JSON overlay

#### 详细解决方案

1. 实现跨区域事件复制（基于 event store 的 CDC 流）
2. 使用 Kustomize overlay 或 Helm values 文件管理环境差异

---

### §33 路线图

**实现状态**: 信息性章节

Phase 1-3 对应实际已实现功能，Phase 4 部分实现，Phase 5-7 为脚手架代码。与代码库当前状态一致。

---

### §34 术语表 / §36 版本日志

**实现状态**: ✅ 文档性章节，无代码实现要求

---

### §35 目录结构

**实现状态**: ✅ 95%

#### 发现的问题

- 文档中定义但代码中缺失的 5 个目录：
  - `src/platform/cost-management/` — 成本管理（实际在 `scale-ecosystem/`）
  - `src/platform/agent-delegation/` — Agent 委派（仅有类型文件）
  - `src/platform/prompt-registry/` — Prompt 注册表（在 `prompt-engine/` 中）
  - `src/testing/` — 测试工具库
  - `src/benchmarks/` — 性能基准测试

- 代码中存在但文档未定义的 15+ 目录（均为合理扩展）

#### 详细解决方案

按文档创建缺失目录并迁移相关代码，或更新文档反映实际结构选择。

---

### §37 领域建模

**实现状态**: 🟡 65%

所有 8 个核心领域概念均存在，但实现大幅简化。

#### 发现的问题

| 领域概念  | 文档字段数 | 实现字段数 | 缺失    |
| --------- | ---------- | ---------- | ------- |
| Task      | 22         | 14         | 8 字段  |
| Execution | 18         | 12         | 6 字段  |
| Agent     | 15         | 8          | 7 字段  |
| Pack      | 20         | 10         | 10 字段 |
| Policy    | 12         | 9          | 3 字段  |
| Incident  | 16         | 10         | 6 字段  |
| Approval  | 14         | 8          | 6 字段  |
| Tenant    | 18         | 6          | 12 字段 |

**Tenant 模型最为简化**（仅 6/18 字段），缺少配额、计费、SLA 等关键属性。

#### 详细解决方案

按优先级补充字段：

1. **Tenant**: 补充 `quotas`, `billingPlan`, `slaLevel`, `allowedRegions` 等 12 字段
2. **Pack**: 补充 `dependencies`, `sandboxRequirements`, `requiredPermissions` 等 10 字段
3. **Agent**: 补充 `delegationConstraints`, `autonomyLevel`, `trustScore` 等 7 字段
4. 其余模型逐步补齐

---

### §38 领域接入

**实现状态**: 🟡 80%

4 阶段接入模型（Define → Validate → Deploy → Monitor）已实现。

#### 发现的问题

- Gate check（阶段门检查）过于简单：仅检查必填字段，未检查运行时兼容性
- 缺少接入回滚机制（一旦 Deploy 阶段失败，需手动清理）

#### 详细解决方案

1. Gate check 增加：依赖解析验证、沙箱兼容性测试、资源配额预检
2. 每个阶段记录 rollback 点，失败时自动回退到上一阶段

---

## 四、上层交互与生态层 §39-§69

> 本节覆盖自然语言交互、组织治理、生态市场、运维成熟度等上层模块。
> 通用模式：大多数模块采用"薄子组件 index.ts（3-20 行）+ 厚编排服务（100-600+ 行）"的结构。

### §39 自然语言入口（NL Gateway）

**实现状态**: 🟡 80%（553 行）

意图解析、实体提取、对话状态管理已实现。

#### 发现的问题

- 多轮对话的上下文窗口管理硬编码为 10 轮，未从配置加载
- 缺少意图消歧交互（当置信度 < 阈值时应主动向用户确认）

#### 详细解决方案

1. 将对话窗口大小迁移到 config，支持按 task-type 配置
2. 添加 `DisambiguationHandler`：置信度 < 0.7 时生成澄清问题返回用户

---

### §40 目标分解（Goal Decomposer）

**实现状态**: 🟡 80%（427 行）

目标到子任务的分解逻辑已实现，支持树状分解。

#### 发现的问题

- 分解深度无限制，理论上可无限递归
- 子任务间依赖关系仅支持顺序执行，不支持 DAG 并行

#### 详细解决方案

1. 添加最大分解深度配置（建议默认 5 层）
2. 扩展子任务关系模型支持 `depends_on: string[]`，调度时按 DAG 拓扑排序并行执行无依赖子任务

---

### §41 主动式 Agent

**实现状态**: 🟡 75%（379 行）

触发条件评估和主动建议生成已实现。

#### 发现的问题

- 主动触发频率无上限，可能造成通知疲劳
- 缺少用户偏好学习（哪些主动建议被采纳/忽略）

#### 详细解决方案

1. 添加触发频率限制：同类建议每小时最多 N 次
2. 记录用户对主动建议的响应，反馈给 Feedback Loop（§56）调整触发策略

---

### §42 自治等级

**实现状态**: 🟡 75%（328 行）

L0-L4 五级自治等级定义和切换逻辑已实现。

#### 发现的问题

- 自治等级的升降条件为静态规则，缺少基于历史表现的动态调整
- 缺少自治等级变更审计记录

#### 详细解决方案

1. 接入 agent 历史成功率和风险事件数，动态计算推荐自治等级
2. 自治等级变更时写入 audit trail

---

### §43 仪表盘

**实现状态**: 🟡 75%（372 行）

仪表盘数据聚合和 API 已实现。

#### 发现的问题

- 数据刷新为全量查询，无增量更新机制
- 缺少实时 WebSocket 推送

#### 详细解决方案

1. 使用 projection 作为仪表盘数据源，天然支持增量更新
2. 添加 WebSocket 通道，projection 更新时推送差量到前端

---

### §44 UX 流程

**实现状态**: 🟡 75%（538 行）

用户交互流程定义和状态管理已实现。

#### 发现的问题

- 无 A/B 测试框架支持
- 缺少用户操作埋点

#### 详细解决方案

1. 复用 rollout-controller 的 traffic split 能力实现 UX A/B 测试
2. 在关键交互节点添加事件埋点，发送到 event bus

---

### §45 对话体验

**实现状态**: 🟡 70%（~200 行）

基础对话管理已实现，但功能较薄。

#### 发现的问题

- 缺少对话历史持久化（重启后丢失）
- 缺少对话模板系统

#### 详细解决方案

1. 对话历史写入 memory store（§29）
2. 对话模板纳入 prompt-engine 管理

---

### §46 组织模型

**实现状态**: 🟡 80%（639 行）

组织层级、角色、权限模型已实现。

#### 发现的问题

- 组织层级仅支持 3 层（org → team → member），文档定义 5 层（org → division → department → team → member）
- 缺少跨组织协作模型

#### 详细解决方案

1. 扩展组织层级支持 5 层，中间 2 层为可选
2. 添加跨组织协作的访客角色（guest role with scoped permissions）

---

### §47 审批策略

**实现状态**: 🟡 70%（~150 行）

基础审批规则引擎已实现。

#### 发现的问题

- 审批策略为硬编码 if-else，非规则引擎驱动
- 缺少审批策略版本管理

#### 详细解决方案

1. 将审批规则迁移到声明式 JSON 配置，由 policy-engine 统一执行
2. 审批策略纳入版本管理，变更需经审批流

---

### §48 SSO/SCIM

**实现状态**: 🔴 30%（86 行）— 严重不足

#### 发现的问题

**仅有 schema 定义，无实际协议处理逻辑**

- 无 SAML/OIDC 协议实现
- 无 SCIM 用户/组同步端点
- 无 token 校验和会话管理

#### 详细解决方案

建议分两阶段实现：

1. **P0 — OIDC 集成**: 使用 `openid-client` 库实现授权码流程，对接企业 IdP
2. **P1 — SCIM 端点**: 实现 `/scim/v2/Users` 和 `/scim/v2/Groups` 的 CRUD，支持增量同步

---

### §49 权限委派

**实现状态**: 🟡 65%（~130 行）

基础权限委派逻辑存在。

#### 发现的问题

- 委派深度无限制
- 缺少权限回收机制（委派过期后自动回收）

#### 详细解决方案

1. 添加委派深度限制（默认 3 层）
2. 委派记录增加 `expiresAt` 字段，定时任务扫描过期委派并回收

---

### §50 合规审计

**实现状态**: 🟡 70%（~140 行）

审计日志记录和查询已实现。

#### 发现的问题

- 审计日志无防篡改保护（可被直接修改）
- 缺少审计报告自动生成

#### 详细解决方案

1. 审计日志增加 hash chain（每条记录包含前一条的 hash），防止篡改
2. 定时生成合规审计报告，输出为 PDF/CSV

---

### §51 委派治理

**实现状态**: 🔴 40%（78 行）

仅有基础类型定义。

#### 发现的问题

- 治理规则引擎缺失
- 无委派审计追踪

#### 详细解决方案

复用 policy-engine 的规则引擎，为委派治理定义专用规则集。

---

### §52-§54 多区域、生态合作、跨平台

**实现状态**: 🟡 65%（各 100-180 行）

#### 发现的问题（共性）

- 多区域数据同步策略仅有设计，无实现
- 生态合作的 API 网关联邦尚未搭建
- 跨平台适配层仅支持 REST，缺少 gRPC 和 GraphQL

#### 详细解决方案

1. 多区域：实现基于 event store CDC 的异步复制
2. 生态合作：在 API Gateway 增加联邦路由层
3. 跨平台：添加 gRPC adapter（使用 `@grpc/grpc-js`）

---

### §55 Marketplace

**实现状态**: ✅ 90%（~7,000 行）— 上层最完整模块

Pack 发布、搜索、评价、下载全流程已实现。

#### 发现的问题

- 缺少 Pack 安全审查自动化（依赖人工审查）
- 缺少 Pack 依赖冲突检测

#### 详细解决方案

1. 添加自动化安全扫描：发布时运行沙箱化测试 + 静态分析
2. 实现依赖解析器：检测版本冲突并提示解决方案

---

### §56 反馈循环

**实现状态**: 🟡 80%（739 行）

反馈收集、分类、分析管道已实现。

#### 发现的问题

- 反馈到模型微调的闭环未打通（收集了反馈但未用于改进）
- 缺少反馈质量评估

#### 详细解决方案

1. 将高质量反馈导出为微调数据集格式（JSONL），供 model evaluation 使用
2. 添加反馈去噪：过滤重复、矛盾、低信息量反馈

---

### §57 版本管理

**实现状态**: 🟡 70%（~120 行）

基础版本号管理存在。

#### 发现的问题

- 未实现语义化版本强制（允许随意版本号）
- 缺少版本兼容性矩阵

#### 详细解决方案

1. 强制 semver 格式校验
2. 维护 pack 版本兼容性矩阵，安装时检查

---

### §58 认证体系

**实现状态**: 🟡 70%（~130 行）

与 §48 SSO 部分重叠，token 管理基础实现。

#### 发现的问题

- Token 刷新机制不完整（access token 过期后需重新登录）
- 缺少 API Key 管理界面

#### 详细解决方案

1. 实现 refresh token 轮换机制
2. 添加 API Key CRUD 端点

---

### §59 多区域扩展

**实现状态**: 🟡 65%（~140 行）

区域定义和路由规则已实现。

#### 发现的问题

- 与 §52 存在功能重叠
- 区域故障转移策略未实现

#### 详细解决方案

1. 合并 §52 和 §59 的实现，消除重复
2. 实现区域 health check + 自动故障转移

---

### §60 应急响应

**实现状态**: 🟡 75%（225 行）

应急事件创建、升级、通知链路已实现。

#### 发现的问题

- 缺少 runbook 自动化（文档引用但无执行引擎）
- 应急演练功能缺失

#### 详细解决方案

1. 实现 runbook 执行器：解析 markdown runbook，逐步执行并记录结果
2. 添加应急演练模式：模拟事件触发，验证响应流程

---

### §61 Agent 生命周期

**实现状态**: 🟡 75%（216 行）

Agent 注册、启动、停止、健康检查已实现。

#### 发现的问题

- 缺少 Agent 版本管理（同一 Agent 的多版本共存）
- 缺少 Agent 性能画像（哪些任务类型该 Agent 表现最好）

#### 详细解决方案

1. Agent 注册时绑定版本号，支持蓝绿部署
2. 基于历史执行数据构建 Agent 能力画像，用于智能路由

---

### §62 可解释性

**实现状态**: 🟡 70%（~150 行）

决策日志和推理链记录已实现。

#### 发现的问题

- 可解释性输出为纯文本，缺少结构化格式
- 缺少面向非技术用户的简化解释

#### 详细解决方案

1. 定义结构化解释格式（decision tree JSON）
2. 添加解释简化器：将技术解释转换为自然语言摘要

---

### §63 漂移检测

**实现状态**: ✅ 90%（~2,400 行）— 第二完整的上层模块

配置漂移、行为漂移、模型漂移检测全面实现。

#### 发现的问题

- 漂移修复仅发告警，无自动修复选项
- 漂移基线更新需手动操作

#### 详细解决方案

1. 为配置漂移添加自动修复（回滚到基线配置）
2. 提供一键更新基线命令

---

### §64-§68 调试器、边缘计算、监控增强、容量规划、混沌工程

**实现状态**: 🟡 65%（各 100-180 行）

#### 发现的问题（共性）

这些模块均处于"核心框架搭好，细节功能待补"的状态：

| 模块         | 已有           | 缺失                       |
| ------------ | -------------- | -------------------------- |
| §64 调试器   | 断点、变量查看 | 时间旅行调试、远程调试     |
| §65 边缘计算 | 边缘节点注册   | 离线模式、边缘-云同步      |
| §66 监控增强 | 指标收集       | 异常检测 ML 模型、根因分析 |
| §67 容量规划 | 资源统计       | 预测模型、自动扩缩建议     |
| §68 混沌工程 | 故障注入框架   | 实验调度、自动化稳态验证   |

#### 详细解决方案

按优先级补齐：

1. **P1**: §64 时间旅行调试（回放 event store 实现）
2. **P1**: §66 异常检测（基于 SLO 阈值的统计方法，避免引入 ML 依赖）
3. **P2**: §68 实验调度器（复用 scheduler 组件）
4. **P2**: §65 离线模式
5. **P3**: §67 预测模型

---

### §69 平台运维 Agent

**实现状态**: 🟡 75%（285 行）

自动化运维任务执行（健康检查、日志分析、告警响应）已实现。

#### 发现的问题

- 运维 Agent 的自治范围未限定（理论上可执行任何运维操作）
- 缺少运维操作审批流（高风险操作如重启服务应经审批）

#### 详细解决方案

1. 定义运维操作白名单，高风险操作需经 approval-manager 审批
2. 运维 Agent 绑定 L2 自治等级（§42），高风险操作自动升级到 HITL

---

## 五、总结与优先级矩阵

### 5.1 全局实现状态总览

| 章节范围               | 节数   | ✅ 完整 | 🟡 部分 | 🔴 严重不足 | 平均对齐度 |
| ---------------------- | ------ | ------- | ------- | ----------- | ---------- |
| §1-§3 概述             | 3      | 3       | 0       | 0           | 100%       |
| §4-§9 平台基础设施     | 6      | 2       | 4       | 0           | 82%        |
| §10-§23 核心功能       | 14     | 2       | 11      | 1           | 76%        |
| §24-§38 基础设施与领域 | 12     | 2       | 10      | 0           | 71%        |
| §39-§69 上层交互与生态 | 31     | 2       | 27      | 2           | 71%        |
| **总计**               | **66** | **11**  | **52**  | **3**       | **74%**    |

> §34/§36/§70 为文档性章节，不计入统计。

### 5.2 最强实现区域 TOP 5

| 排名 | 模块            | 对齐度 | 代码量    | 说明                           |
| ---- | --------------- | ------ | --------- | ------------------------------ |
| 1    | §9 稳定性七层   | 100%   | —         | 全部 7 层防护完整实现          |
| 2    | §13 OAPEFLIR    | 95%    | 68+ 文件  | 8 阶段编排引擎，最核心模块     |
| 3    | §55 Marketplace | 90%    | ~7,000 行 | 上层最完整模块                 |
| 4    | §63 漂移检测    | 90%    | ~2,400 行 | 三类漂移检测全面覆盖           |
| 5    | §14 运行时执行  | 90%    | —         | Dispatch + Worker 生命周期完善 |

### 5.3 最薄弱区域 TOP 5

| 排名 | 模块           | 对齐度 | 代码量 | 影响                         |
| ---- | -------------- | ------ | ------ | ---------------------------- |
| 1    | §6 API 端点    | 15%    | —      | 10/20 端点缺失，阻塞外部集成 |
| 2    | §19 Agent 委派 | 25%    | ~50 行 | 核心编排能力缺失             |
| 3    | §48 SSO/SCIM   | 30%    | 86 行  | 企业集成阻塞                 |
| 4    | §51 委派治理   | 40%    | 78 行  | 治理合规风险                 |
| 5    | §30 业务包     | 50%    | —      | 领域接入模型不匹配           |

### 5.4 关键缺失项清单

| #   | 缺失项                       | 影响节 | 严重程度    | 预估工作量 |
| --- | ---------------------------- | ------ | ----------- | ---------- |
| 1   | REST API 端点（10/20 缺失）  | §6     | P0-Critical | 5-8 人天   |
| 2   | Agent 委派运行时             | §19    | P0-Critical | 8-12 人天  |
| 3   | LLM D0-D4 五级降级           | §15    | P0-Critical | 3-5 人天   |
| 4   | 加密销毁（Crypto-shredding） | §23    | P0-Critical | 5-8 人天   |
| 5   | SSO/SCIM 协议实现            | §48    | P1-High     | 8-12 人天  |
| 6   | ProjectionUpdate 契约        | §5     | P1-High     | 1-2 人天   |
| 7   | 存储层 30 张表               | §26    | P1-High     | 5-8 人天   |
| 8   | 9 个事件命名空间             | §28    | P1-High     | 3-5 人天   |
| 9   | BusinessPackManifest         | §30    | P1-High     | 3-5 人天   |
| 10  | 沙箱第 4 层                  | §11    | P1-High     | 3-5 人天   |
| 11  | Pack/Plugin/Client SDK       | §22    | P2-Medium   | 12-20 人天 |
| 12  | 领域模型字段补齐             | §37    | P2-Medium   | 5-8 人天   |
| 13  | 多层配置体系                 | §24    | P2-Medium   | 3-5 人天   |
| 14  | Outbox Pattern               | §7     | P2-Medium   | 3-5 人天   |
| 15  | Prompt Bundle 体系           | §16    | P2-Medium   | 3-5 人天   |

### 5.5 实施路线图建议

#### Phase 1 — 核心补齐（4-6 周）

**目标**: 消除所有 P0-Critical 缺失项

| 周次  | 任务                  | 对应缺失项 |
| ----- | --------------------- | ---------- |
| W1-W2 | REST API 端点补齐     | #1         |
| W1-W3 | Agent 委派完整实现    | #2         |
| W2-W3 | LLM 五级降级模型      | #3         |
| W3-W4 | Crypto-shredding 实现 | #4         |
| W4-W6 | 集成测试 + 回归验证   | —          |

#### Phase 2 — 高优补齐（4-6 周）

**目标**: 消除所有 P1-High 缺失项

| 周次  | 任务                                | 对应缺失项 |
| ----- | ----------------------------------- | ---------- |
| W1-W3 | SSO/SCIM 协议实现                   | #5         |
| W1-W2 | 存储层 30 张表 + PG migration       | #7         |
| W2-W3 | 事件命名空间 + BusinessPackManifest | #8, #9     |
| W3-W4 | ProjectionUpdate + 沙箱第 4 层      | #6, #10    |
| W4-W6 | 集成测试 + 安全审计                 | —          |

#### Phase 3 — 体验完善（6-8 周）

**目标**: 消除 P2-Medium 缺失项 + 命名统一

| 周次  | 任务                                   | 对应缺失项    |
| ----- | -------------------------------------- | ------------- |
| W1-W4 | SDK 体系补齐（Pack → Plugin → Client） | #11           |
| W2-W4 | 领域模型字段补齐                       | #12           |
| W3-W5 | 配置治理 + Outbox + Prompt Bundle      | #13, #14, #15 |
| W5-W6 | 命名统一（Risk/Memory/Trust 等）       | §10, §29      |
| W6-W8 | 全量回归 + 文档同步                    | —             |

### 5.6 通用模式观察

1. **薄子组件 + 厚编排**: 大部分模块的子组件（3-20 行 `index.ts`）仅做类型导出，真正逻辑集中在一个编排服务中。这导致子组件无法独立测试。**建议**: 将业务逻辑从编排服务下沉到子组件。

2. **契约双重定义**: `contracts/{name}/index.ts` 和 `contracts/types/platform-contracts.ts` 存在重复定义。**建议**: 统一到一处，另一处做 re-export。

3. **命名漂移**: 代码中多处命名与架构文档不一致（如 `RiskAssessor` vs `RiskEvaluationEngine`）。**建议**: 创建命名映射表，分批统一。

4. **配置硬编码**: 多处策略参数（风险矩阵、自治阈值、重试策略等）硬编码在代码中。**建议**: 统一迁移到 `config/` 目录，通过 config-manager 加载。

5. **Quality Gate 桩实现**: 多个模块的质量门检查直接返回 `true`。**建议**: P1 优先级补齐真实的质量门逻辑。

---

> **审查结论**: 平台整体架构对齐度 **74%**，核心编排引擎（OAPEFLIR）和稳定性防护是最强区域。最紧迫的 4 个 P0 缺失项（API 端点、Agent 委派、LLM 降级、加密销毁）应在 Phase 1 中优先解决。上层模块大多已有框架但功能较薄，可在 Phase 3 中逐步完善。

---

## 六、文档质量审查

> 以下对 `docs_zh/` 下全部 165 个文件（约 39,001 行）进行质量审查，覆盖架构文档、契约文档、ADR、运维文档、质量文档、迁移文档、治理文档、指南和分析报告。

### 6.1 架构文档（`docs_zh/architecture/`，6 文件，~11,187 行）

#### 6.1.1 `00-platform-architecture.md`

| #   | 类型     | 位置            | 问题描述                                                                                                                                                        | 修改方案                                                                          |
| --- | -------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | 内部矛盾 | 行 6648         | 术语表 OAPEFLIR 展开为 `Observe-Assess-Plan-Execute-Feedback-Learn-Improve-Recover`，但文档正文 §13.1（行 1242）和 §13.2（行 1354）均使用 `Release` 作为 R 阶段 | 将术语表行 6648 的 `Recover` 改为 `Release`                                       |
| 2   | 内部矛盾 | 行 5819         | `StageRationale` 类型中包含未定义的 `"review"` 阶段                                                                                                             | 将 `"review"` 改为 `"release"`，与 OAPEFLIR 8 阶段一致                            |
| 3   | 结构问题 | 行 286-298      | 目录编号跳跃：§44 直接到 §46（缺 §45），§57 直接到 §59（缺 §58），正文中也无对应内容                                                                            | 补充 §45 和 §58 的内容，或重新编号消除间隙                                        |
| 4   | 过时路径 | §35（行 3149+） | 推荐目录中列出 `compliance/erasure/`、`compliance/encryption/`、`compliance/data-residency/`、`compliance/lineage/` 等子目录                                    | 实际 `src/platform/compliance/` 仅有 6 个文件，无这些子目录。标注为"计划中"或删除 |
| 5   | 过时路径 | §35             | 列出 `state-evidence/incident/`、`state-evidence/checkpoints/`、`state-evidence/dlq/`                                                                           | 这些子目录在实际代码中不存在。标注为"计划中"或删除                                |
| 6   | 过时路径 | §35（行 3149）  | 列出 `execution/scheduler/`                                                                                                                                     | 实际无此目录，Scheduler 在 `interface/scheduler/` 下。修正路径                    |
| 7   | 结构问题 | 行 1491         | §14 与 §15 之间缺少 `---` 分隔线，破坏全文一致的分隔模式                                                                                                        | 添加 `---` 分隔线                                                                 |

#### 6.1.2 `01-code-structure.md`

| #   | 类型     | 位置       | 问题描述                                                                                                                                                                              | 修改方案                       |
| --- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | 过时内容 | 行 421-460 | `execution/execution-engine/` 文件列表不完整，缺少 `multi-step-supervisor.ts`、`multi-step-tool-definitions.ts`、`orphan-cleanup-service.ts`、`kv-cache-prefix-config.ts` 等 9 个文件 | 重新生成文件列表，补充缺失文件 |
| 2   | 过时内容 | 行 337-350 | `interface/api/` 仅列出 `index.ts`，实际包含 `http-server/`（16+ 文件）、`middleware/`（2 文件）、`oidc-oauth/`（3 文件）等子目录                                                     | 补充完整的子目录结构           |
| 3   | 事实错误 | 行 352     | 列出 `interface/webhook/webhook-receiver.ts`，实际仅有 `webhook/index.ts`                                                                                                             | 修正文件名                     |
| 4   | 事实错误 | 行 477-499 | Repository 文件列为 `truth/repositories/` 下，实际主要在 `truth/sqlite/repositories/`（22 文件）                                                                                      | 修正路径层级                   |
| 5   | 路径引用 | 行 54      | 引用 `doc/` 目录，应为 `docs_zh/` 或 `docs_en/`                                                                                                                                       | 修正为正确的文档目录名         |

#### 6.1.3 `02-code-architecture-reference.md`

| #   | 类型     | 位置                | 问题描述                                                                                                                                                              | 修改方案                                                  |
| --- | -------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | 内部矛盾 | 行 38 vs 699 vs 806 | 测试数量三处不一致：行 38 称 `~9,141`，行 699 称 `~9,255`，行 806 称 `test() 9,116 + it() 139`                                                                        | 重新统计并统一为一个权威数字                              |
| 2   | 事实错误 | 行 667              | `admission-controller.ts` 标注路径为 `execution/execution-engine/`，实际在 `execution/dispatcher/`                                                                    | 修正路径为 `execution/dispatcher/admission-controller.ts` |
| 3   | 过时内容 | 行 293-301          | 描述 5 个合规服务（DataResidencyPolicyService、FieldEncryptionService、ErasurePlanningService、DataLineageService），实际仅 `ComplianceCaseOrchestrationService` 存在 | 标注其余 4 个为"计划中"，或删除                           |

#### 6.1.4 `03-module-diagrams.md`（问题最严重）

| #   | 类型         | 位置         | 问题描述                                                                                                                                   | 修改方案                                                                                                                                  |
| --- | ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **全文过时** | 全文         | 使用旧文件名和不存在的 `ai-ops` 路径前缀，整个文件似乎是早期草稿                                                                           | **需全面重写**以匹配当前代码结构                                                                                                          |
| 2   | 错误引用     | 行 5         | 引用 `agent_platform_design_architecture.md`、`code_file_structure.md`、`migration_assessment.md`                                          | 修正为 `00-platform-architecture.md`、`01-code-structure.md`、`02-code-architecture-reference.md`                                         |
| 3   | 事实错误     | 行 330       | OAPEFLIR 展开为 `Observe Analyze Plan Execute...`，"Analyze" 应为 "Assess"                                                                 | 将 `Analyze` 改为 `Assess`                                                                                                                |
| 4   | 错误路径     | 行 1364      | 引用 `platform/ai-ops/compliance/`                                                                                                         | 修正为 `platform/compliance/`                                                                                                             |
| 5   | 错误路径     | 行 1397-1398 | 引用 `platform/ai-ops/model-gateway`、`platform/ai-ops/tool-executor`、`platform/ai-ops/workflow`                                          | 修正为 `platform/model-gateway/`、`platform/execution/tool-executor/`、`platform/orchestration/oapeflir/workflow/`                        |
| 6   | 错误映射     | 行 1402-1428 | 迁移目标路径多处错误：`evaluation → ops-maturity/compliance-reporter`、`memory → interaction/memory`、`security → org-governance/sso-scim` | 修正为：`evaluation → platform/prompt-engine/eval/`、`memory → platform/state-evidence/memory/`、`security → platform/control-plane/iam/` |

#### 6.1.5 `04-runtime-sequence.md`

| #   | 类型     | 位置   | 问题描述                                               | 修改方案                                                             |
| --- | -------- | ------ | ------------------------------------------------------ | -------------------------------------------------------------------- |
| 1   | 事实错误 | 行 3   | 声称"四条核心运行时执行路径"，实际文档中描述了 7 条    | 修正为"七条核心运行时执行路径"                                       |
| 2   | 错误路径 | 行 287 | 引用 `execution-worker-handshake/writeback-service.ts` | 修正为 `execution/worker-pool/execution-worker-writeback-service.ts` |

---

### 6.2 契约文档（`docs_zh/contracts/`，113 文件，~14,200 行）

#### 6.2.1 桩/占位契约（缺少实质内容）

以下 16 个契约文件仅有模板框架，无 TypeScript 接口定义、无 schema 约束、无跨契约关联。需要补充完整规格。

**严重桩（≤ 35 行）**:

| #   | 文件                                               | 行数 | 修改方案                                                           |
| --- | -------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| 1   | `workflow_debugger_contract.md`                    | 33   | 补充：断点类型定义、变量观察接口、时间旅行 API、远程调试协议       |
| 2   | `behavior_drift_detection_contract.md`             | 34   | 补充：漂移指标定义、基线模型、检测算法接口、告警阈值配置           |
| 3   | `capacity_planning_contract.md`                    | 34   | 补充：资源模型、预测算法接口、扩缩容触发条件、容量报告格式         |
| 4   | `compliance_report_generation_contract.md`         | 34   | 补充：报告模板定义、数据源声明、生成周期配置、输出格式（PDF/CSV）  |
| 5   | `edge_runtime_and_sync_contract.md`                | 34   | 补充：边缘节点注册协议、离线模式状态机、云边同步机制、冲突解决策略 |
| 6   | `cost_attribution_and_optimization_contract.md`    | 35   | 补充：成本归因模型、优化建议接口、模拟场景定义                     |
| 7   | `platform_panic_and_resume_contract.md`            | 35   | 补充：panic 触发条件、状态快照格式、恢复检查清单、人工确认流程     |
| 8   | `quota_preemption_and_fair_scheduling_contract.md` | 35   | 补充：配额策略完整字段、抢占优先级算法、公平调度器接口             |
| 9   | `sla_tier_contract.md`                             | 35   | 补充：SLA 层级定义（P0-P3）、响应时间承诺、可用性目标、违约处理    |

**轻度桩（36-48 行）**:

| #   | 文件                                                  | 行数 | 修改方案                                    |
| --- | ----------------------------------------------------- | ---- | ------------------------------------------- |
| 10  | `multimodal_gateway_contract.md`                      | 41   | 补充多模态输入/输出格式、模态路由规则       |
| 11  | `explainability_and_stage_rationale_contract.md`      | 43   | 补充结构化解释格式、简化解释生成规则        |
| 12  | `cross_region_routing_and_data_residency_contract.md` | 43   | 补充区域路由策略、数据驻留合规规则          |
| 13  | `platform_ops_agent_contract.md`                      | 43   | 补充运维操作白名单、自治等级绑定规则        |
| 14  | `connector_framework_contract.md`                     | 45   | 补充连接器 SPI、生命周期、配置格式          |
| 15  | `feedback_improvement_pipeline_contract.md`           | 47   | 补充反馈收集→分类→分析→改进全流程接口       |
| 16  | `agent_definition_lifecycle_contract.md`              | 48   | 补充 Agent 生命周期完整状态机、版本管理规则 |

#### 6.2.2 跨契约矛盾

| #   | 矛盾对象               | 契约 A                                                                                                       | 契约 B                                                                                               | 问题                                                      | 修改方案                                                                                                |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | `AgentDefinition` 字段 | `agent_contract.md`: `id`, `name`, `model_tier`, `tools`, `scope` 等                                         | `agent_definition_lifecycle_contract.md`: `agent_id`, `display_name`, `domain_id`, `capabilities` 等 | 同名类型字段完全不同，ID 命名不一致（`id` vs `agent_id`） | 统一为一个权威 `AgentDefinition`，另一处引用。建议以 `agent_contract.md` 为主，lifecycle 契约引用并扩展 |
| 2   | 事件命名格式           | `event_bus_contract.md`: 点号分隔 `feedback.signal_received`                                                 | `typed_event_bus_contract.md`: 冒号分隔 `feedback:collected`                                         | 两个契约对同一事件定义了不同的命名规范                    | 统一使用点号分隔格式（与代码中 EventEmitter 一致），在 `typed_event_bus_contract.md` 中修正             |
| 3   | 成本追踪对象           | `cost_and_budget_contract.md`: `CostEvent`                                                                   | `cost_attribution_and_optimization_contract.md`: `CostAttributionRecord`                             | 两个契约定义重叠的成本追踪对象，字段结构不同              | 合并为统一的 `CostEvent` 类型，`CostAttributionRecord` 作为扩展子类型                                   |
| 4   | `workflow_state` 字段  | `task_and_workflow_contract.md`: 包含 `current_stage`, `loop_iteration`, `feedback_signals` 等 OAPEFLIR 字段 | `storage_schema_contract.md`: DDL 中无这些列                                                         | 业务契约声明的字段在存储 schema 中缺失                    | 在 `storage_schema_contract.md` 的 `workflow_state` DDL 中补充缺失列                                    |
| 5   | `QuotaPolicy`          | `billing_and_tenant_contract.md`: 仅列名，无字段                                                             | `quota_preemption_and_fair_scheduling_contract.md`: 定义了 `scope`, `hard_limit` 等字段              | 同一对象在两处定义程度不同                                | 在 `billing_and_tenant_contract.md` 中补充字段定义或引用另一契约                                        |

#### 6.2.3 代码路径引用错误

| #   | 文件                               | 问题                                                                                                    | 修改方案                                                                                                                 |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | `project_structure_contract.md` §3 | 声明 `src/core/` 为权威结构（包含 `api/`, `artifacts/`, `config/`, `events/`, `memory/` 等 25+ 子目录） | **严重不匹配**: 实际 `src/core/` 仅有 `runtime/`（几个文件），真正代码在 `src/platform/`。需全面重写此契约的项目结构部分 |
| 2   | `project_structure_contract.md`    | `config/` 结构缺少 `domains/`、`environments/`、`knowledge/`、`plugins/`、`product/` 子目录             | 补充实际存在的 5 个子目录                                                                                                |

#### 6.2.4 重叠/重复契约

以下契约对存在大量功能重叠，建议合并或明确划分职责：

| #   | 重叠契约组                                                                                                                                                          | 问题                                                                | 修改方案                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | `event_bus_contract.md` + `event_reliability_matrix_contract.md` + `event_registry_and_ops_threshold_contract.md` + `typed_event_bus_contract.md`                   | 4 个契约均部分重定义事件类型、层级和命名                            | 合并为 2 个：`event_bus_contract.md`（核心定义）+ `event_ops_contract.md`（可靠性+阈值+注册表） |
| 2   | `cost_and_budget_contract.md` + `cost_attribution_and_optimization_contract.md` + `token_budget_allocation_contract.md` + `monetization_metering_plane_contract.md` | 4 个成本相关契约对象定义重叠                                        | 合并为 2 个：`cost_model_contract.md`（核心模型）+ `monetization_contract.md`（商业化计量）     |
| 3   | `approval_and_hitl_contract.md` + `hitl_experience_and_explainability_contract.md`                                                                                  | HITL 对象和审批体验重复定义                                         | 合并为一个 `hitl_contract.md`                                                                   |
| 4   | `runtime_state_machine_contract.md` + `state_transition_matrix_contract.md`                                                                                         | 两者定义相同的状态机（TaskStatus, WorkflowStatus, ExecutionStatus） | 合并为一个 `state_machine_contract.md`                                                          |
| 5   | `agent_contract.md` + `agent_definition_lifecycle_contract.md`                                                                                                      | `AgentDefinition` 字段不兼容                                        | 合并为一个 `agent_contract.md`，lifecycle 作为章节                                              |
| 6   | `perception_contract.md` + `perception_intelligence_plane_contract.md`                                                                                              | 均定义 Observe/Assess 对象                                          | 合并为一个 `perception_plane_contract.md`                                                       |

#### 6.2.5 命名与格式问题

| #   | 问题                  | 涉及文件                                                                                                    | 修改方案                                                             |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | 文件名不一致          | `adr-unified-resource-model.md` 使用连字符且无 `_contract` 后缀                                             | 重命名为 `unified_resource_model_contract.md`，或移到 `docs_zh/adr/` |
| 2   | 缺少 `_contract` 后缀 | `error_code_registry.md`                                                                                    | 重命名为 `error_code_registry_contract.md`                           |
| 3   | ADR 混入契约目录      | `adr-unified-resource-model.md` 是 ADR 而非契约                                                             | 移至 `docs_zh/adr/`                                                  |
| 4   | 语言不一致            | `result_envelope_contract.md` 主要用英文撰写，其余契约用中文                                                | 翻译为中文，保持全目录语言统一                                       |
| 5   | 无关 OAPEFLIR 标注    | `billing_and_tenant_contract.md`、`tenant_and_organization_contract.md`、`gateway_streaming_contract.md` 等 | 移除与该契约无关的 OAPEFLIR 阶段关联标注，仅保留真正相关的阶段       |

#### 6.2.6 缺失契约

| #   | 缺失主题                 | 对应代码                                            | 修改方案                                  |
| --- | ------------------------ | --------------------------------------------------- | ----------------------------------------- |
| 1   | 缓存体系                 | `src/platform/shared/cache/`（策略、存储、失效）    | 新建 `cache_contract.md`                  |
| 2   | Model Gateway 路由       | `src/platform/model-gateway/`                       | 新建 `model_gateway_routing_contract.md`  |
| 3   | Prompt Engine SPI        | `src/platform/prompt-engine/`                       | 新建 `prompt_engine_spi_contract.md`      |
| 4   | SDK 表面契约             | `src/sdk/`（CLI, Pack SDK, Plugin SDK, Client SDK） | 新建 `sdk_surface_contract.md`            |
| 5   | `src/platform/` 顶层架构 | 实际主代码目录                                      | 在 `project_structure_contract.md` 中补充 |

---

### 6.3 ADR 文档（`docs_zh/adr/`，38 文件，~4,252 行）

#### 6.3.1 编号间隙

ADR 编号存在以下间隙：

| 间隙范围 | 缺失编号数 | 说明                                          |
| -------- | ---------- | --------------------------------------------- |
| 021-059  | 39         | 060+ 系列为 OAPEFLIR 时代决策，间隙系有意为之 |
| 061-065  | 5          | 未知原因                                      |
| 067-071  | 5          | 未知原因                                      |
| 073-074  | 2          | 未知原因                                      |
| 076-077  | 2          | 未知原因                                      |

**修改方案**: README 中说明编号策略为"按时间段分配号段"而非"顺序递增"，并列出各号段对应的决策批次。或者，在 `adr/README.md` 中删除"编号顺序递增"的表述。

#### 6.3.2 格式不一致（三套模板）

38 个 ADR 使用了三套不同的模板格式：

| 时代   | ADR 范围 | 格式特征                                                                      | 修改方案                |
| ------ | -------- | ----------------------------------------------------------------------------- | ----------------------- |
| 早期   | 001-015  | `结果` + `优点`/`代价`/`约束` + `交叉引用` + `来源章节`                       | 保留作为标准格式        |
| 中期   | 016-080  | `后果`（简短）+ `备选方案` + `交叉引用` + `来源章节`                          | 将 `后果` 统一为 `结果` |
| 晚期-A | 081-087  | 极简格式：仅 `决策` + `后果`（1-3 条），无 `备选方案`、`交叉引用`、`来源章节` | 补充缺失章节            |
| 晚期-B | 088-090  | 完全不同模板：`取舍` + `影响` + `测试要求`，无 `背景`/`决策`                  | 改为标准格式            |

**修改方案**: 统一所有 ADR 为标准格式：`标题 → 状态 → 日期 → 背景 → 决策 → 结果（优点/代价/约束）→ 备选方案 → 交叉引用 → 来源章节`。

#### 6.3.3 被取代但未标注的 ADR

| ADR     | 当前状态 | 应改为                    | 原因                                                                    |
| ------- | -------- | ------------------------- | ----------------------------------------------------------------------- |
| ADR-003 | Accepted | **Superseded by ADR-020** | ADR-020 重新定义了六层记忆模型，使用不同的 TTL 和晋升规则               |
| ADR-018 | Accepted | **Superseded by ADR-075** | ADR-075 重新定义了发布状态机，Level 和状态集合不兼容                    |
| ADR-007 | Accepted | **Partially Superseded**  | 其中"Release 仅允许 off/suggest/shadow 三档"已被 ADR-075 的六级模型取代 |

**修改方案**: 在被取代的 ADR 头部添加 `状态: Superseded by ADR-0XX`，并在新 ADR 中添加 `取代: ADR-0XX` 反向链接。

#### 6.3.4 内容矛盾

| #   | 矛盾                   | 涉及 ADR                                                                                                                                                                                   | 修改方案                                                                                           |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 1   | **记忆层命名三套方案** | ADR-003: `runtime/session/agent/project/user/evolution`; ADR-020: `RuntimeCache/Session/Agent/Project/User/Evolution`; 架构文档 §29.2: `working/session/episodic/semantic/procedural/meta` | 选定一套权威命名（建议以架构文档 §29.2 为准），其余标注为历史版本                                  |
| 2   | **发布级别不兼容**     | ADR-018: 五级 L0-L5（off/suggest/shadow/canary/staged/stable）; ADR-075: 六级 L0-L5（off/shadow/canary_5/partial_25/stable_75/stable_100）                                                 | ADR-018 的 `suggest` 级别在 ADR-075 中被移除，`shadow` 从 L2 变为 L1。将 ADR-018 标记为 Superseded |
| 3   | **发布状态机不兼容**   | ADR-018: 11 态（draft→pending_approval→shadow→...）; ADR-075: 12 态（candidate_created→under_review→approved→...）                                                                         | 统一以 ADR-075 为准                                                                                |

#### 6.3.5 文件名与内容不匹配

| ADR     | 文件名                       | 实际标题                       | 修改方案                            |
| ------- | ---------------------------- | ------------------------------ | ----------------------------------- |
| ADR-003 | `003-memory-seven-layers.md` | "六层记忆与 KV Cache 固定前缀" | 重命名为 `003-memory-six-layers.md` |

#### 6.3.6 与架构文档不一致

| #   | ADR         | ADR 内容             | 架构文档 §29.2                                                                         | 修改方案                                                                    |
| --- | ----------- | -------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | ADR-003/020 | 记忆层级使用运维命名 | 使用认知科学命名（working/episodic/semantic 等）                                       | ADR 中标注"已被架构文档 §29.2 取代"，或更新架构文档反映 ADR 选择            |
| 2   | 无对应 ADR  | —                    | §34 列出 65+ 建议 ADR 题目（如 `ADR-Platform-Layering`、`ADR-Delegation-Depth-Limit`） | 仅 37 个被正式创建。在 README 中标注哪些建议 ADR 已实现、哪些被归入其他 ADR |

#### 6.3.7 桩 ADR

| ADR     | 行数 | 缺失内容                             | 修改方案                   |
| ------- | ---- | ------------------------------------ | -------------------------- |
| ADR-017 | 48   | 无"备选方案"、"交叉引用"、"来源章节" | 补充缺失章节               |
| ADR-019 | 55   | 无"备选方案"，后果极简               | 补充备选方案和详细后果分析 |
| ADR-088 | 58   | 无"背景"详述、"备选方案"             | 改为标准格式并补充         |
| ADR-089 | 58   | 同 088                               | 同上                       |

#### 6.3.8 交叉引用问题

| ADR            | 引用                                    | 问题                                            | 修改方案                             |
| -------------- | --------------------------------------- | ----------------------------------------------- | ------------------------------------ |
| ADR-072 行 141 | `doc/reviews/design_gap_analysis_v9.md` | 路径使用 `doc/` 前缀而非 `docs_zh/`，可能为断链 | 修正为 `docs_zh/reviews/` 下对应文件 |

---

### 6.4 运维文档（`docs_zh/operations/`，16 文件，~2,544 行）

#### 6.4.1 严重过时文件

| #   | 文件                                        | 问题                                                                                                       | 修改方案                                                                                          |
| --- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | **`src_module_test_matrix.md`**（1,455 行） | **全文引用旧路径** `src/core/tools/`、`src/core/types/`、`src/gateway/` 等，迁移后代码已在 `src/platform/` | 运行 `npm run test:matrix` 重新生成，或手动将所有 `src/core/` 路径更新为 `src/platform/` 对应路径 |
| 2   | **`implementation_plan.md`**                | 全文引用旧结构 `src/core/`、`src/cli/`、`src/gateway/`，与 `02-code-architecture-reference.md` 矛盾        | 更新所有路径引用为新结构                                                                          |
| 3   | `operations-checklist.md` 行 16             | 测试数量报告为 `2383+/2383`，实际为 ~10,606（`project_progress_tracker.md` 行 33）                         | 更新为当前实际测试数                                                                              |

#### 6.4.2 桩/占位文件

| #   | 文件                         | 行数 | 问题                                                      | 修改方案                           |
| --- | ---------------------------- | ---- | --------------------------------------------------------- | ---------------------------------- |
| 1   | `operations-tracker.md`      | 18   | 仅为重定向桩，功能已被 `project_progress_tracker.md` 取代 | 删除此文件，或在内容中标注"已迁移" |
| 2   | `cross-region-validation.md` | 16   | 仅有标题和大纲，无实际验证步骤                            | 补充验证步骤、验收标准、回滚流程   |
| 3   | `capacity-planning.md`       | 24   | 内容极少                                                  | 补充容量模型、基线数据、扩缩容规则 |

#### 6.4.3 断链

| #   | 文件                   | 位置  | 问题                                                         | 修改方案                                                               |
| --- | ---------------------- | ----- | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 1   | `capacity-planning.md` | 行 22 | 引用 `tests/performance/capacity-limits.test.ts`，文件不存在 | 修正为实际存在的性能测试路径（如 `tests/integration/plugin-perf/` 等） |

#### 6.4.4 Runbook 问题

| #   | 文件                            | 问题                                                       | 修改方案                                                                          |
| --- | ------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | 全部 5 个 runbook               | 仅有通用指导，无平台特定命令、日志查询语句、Dashboard 链接 | 为每个 runbook 补充：(1) 具体 CLI 命令 (2) 日志查询模板 (3) Grafana Dashboard URL |
| 2   | `incident-response-playbook.md` | 仅 15 行，缺升级矩阵、沟通模板、事后复盘模板               | 补充完整的事件响应流程                                                            |
| 3   | `operations/README.md`          | 未索引 `runbooks/` 子目录的 5 个文件                       | 在 README 表格中添加 runbook 条目                                                 |

#### 6.4.5 测试数量不一致（跨文档）

| 文件                                | 测试数量 | 日期       |
| ----------------------------------- | -------- | ---------- |
| `operations-checklist.md`           | 2,383    | 未标注     |
| `project_progress_tracker.md`       | 10,606   | 2026-04-18 |
| `02-code-architecture-reference.md` | ~9,141   | 2026-04-20 |

**修改方案**: 指定一个权威数据源（建议为 `npm test` 输出），其余文件引用该数据源而非硬编码数字。

---

### 6.5 质量文档（`docs_zh/quality/`，3 文件，~2,243 行）

| #   | 文件                              | 问题                                                                                                    | 修改方案                                                         |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | `00-full-coverage-test-manual.md` | 全文引用旧 `src/core/` 路径                                                                             | 更新为 `src/platform/` 对应路径                                  |
| 2   | `01-release-checklist.md` 行 25   | 覆盖率门槛 `lines ≥ 60%, branches ≥ 50%`，而 `00-full-coverage-test-manual.md` 记录实际基线为 82%/78.3% | 提高门槛至 `lines ≥ 75%, branches ≥ 70%`，与实际基线保持合理距离 |

---

### 6.6 迁移文档（`docs_zh/migration/`，3 文件，~1,532 行）

| #   | 文件                        | 问题                                                                     | 修改方案                                                           |
| --- | --------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1   | `00-migration-guideline.md` | 全文引用旧 `doc/contracts/`、`doc/adr/`、`doc/operations/` 路径          | 更新为 `docs_zh/contracts/`、`docs_zh/adr/`、`docs_zh/operations/` |
| 2   | `01-migration-scope.md`     | 将迁移视为未来工作（引用 `src/core/` 42 模块结构为"当前"），但迁移已完成 | 标注迁移已完成，添加迁移完成日期和验证结果。或将文件标记为历史文档 |

---

### 6.7 治理文档（`docs_zh/governance/`，7 文件，~964 行）

| #   | 文件                                     | 问题                                                  | 修改方案                                                   |
| --- | ---------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| 1   | `source_of_truth.md` 行 10               | 引用"以 `01` ~ `07` 为准"的旧编号方案                 | 更新为当前 `docs_zh/architecture/00-*.md` ~ `04-*.md` 编号 |
| 2   | `source_of_truth.md` 行 12               | 引用不存在的 `automatic_agent_platform/` 目录         | 删除或修正为实际项目根目录                                 |
| 3   | `glossary_and_terminology.md` 行 302-355 | Section 15 使用了错误的小节编号（标为 13.1、13.2 等） | 修正编号为 15.1、15.2 等                                   |
| 4   | `change_control.md`                      | 仅 43 行，无变更请求模板、审批流程图、工具链引用      | 补充变更请求模板和审批流程                                 |

---

### 6.8 指南文档（`docs_zh/guides/`，4 文件，~281 行）

| #   | 文件                   | 问题                                                       | 修改方案                                                  |
| --- | ---------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| 1   | `contributing.md` 行 9 | 引用 `docs_zh/automatic-agent-architecture.md`，文件不存在 | 修正为 `docs_zh/architecture/00-platform-architecture.md` |
| 2   | 缺失 `README.md`       | 目录无索引文件                                             | 新建 `guides/README.md`，列出 4 个指南的标题和简介        |
| 3   | `quickstart.md`        | 仅 54 行，无故障排查章节                                   | 补充常见问题和排查步骤                                    |

---

### 6.9 分析文档（`docs_zh/analysis/`，3 文件，~231 行）

| #   | 文件                                 | 问题                                                        | 修改方案                               |
| --- | ------------------------------------ | ----------------------------------------------------------- | -------------------------------------- |
| 1   | `01-codebase-vs-design-review.md`    | 未引用最新的 `02-code-architecture-reference.md` 作为权威源 | 添加交叉引用                           |
| 2   | `00-architecture-coverage-matrix.md` | 覆盖率百分比可能已过时                                      | 标注数据截止日期，或设置自动化更新机制 |

---

### 6.10 文档问题总结与修复优先级

#### 问题统计

| 目录            | 文件数  | 发现问题数 | 严重问题 | 中等问题 | 轻微问题 |
| --------------- | ------- | ---------- | -------- | -------- | -------- |
| `architecture/` | 6       | 22         | 4        | 12       | 6        |
| `contracts/`    | 113     | 38         | 7        | 19       | 12       |
| `adr/`          | 38      | 18         | 3        | 10       | 5        |
| `operations/`   | 16      | 15         | 3        | 8        | 4        |
| `quality/`      | 3       | 2          | 0        | 2        | 0        |
| `migration/`    | 3       | 2          | 0        | 2        | 0        |
| `governance/`   | 7       | 4          | 1        | 2        | 1        |
| `guides/`       | 4       | 3          | 1        | 1        | 1        |
| `analysis/`     | 3       | 2          | 0        | 1        | 1        |
| **总计**        | **165** | **106**    | **19**   | **57**   | **30**   |

#### P0 — 必须立即修复（误导性内容，影响开发决策）

| #   | 修复项                                                                                                        | 涉及文件                                                                          | 预估工时 |
| --- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| 1   | `03-module-diagrams.md` 全面重写 — 旧路径、错误 OAPEFLIR 展开、`ai-ops` 前缀不存在                            | `architecture/03-module-diagrams.md`                                              | 4h       |
| 2   | `project_structure_contract.md` §3 重写 — 声明的权威结构与实际代码完全不匹配                                  | `contracts/project_structure_contract.md`                                         | 2h       |
| 3   | `src_module_test_matrix.md` 重新生成 — 1,455 行全部引用旧路径                                                 | `operations/src_module_test_matrix.md`                                            | 1h       |
| 4   | OAPEFLIR "R" 统一为 "Release" — 术语表、StageRationale 类型、`03-module-diagrams.md` 中的 "Recover"/"Analyze" | `architecture/00-platform-architecture.md` 行 6648 + 5819                         | 0.5h     |
| 5   | ADR-018/ADR-075 矛盾解决 — 发布状态机不兼容                                                                   | `adr/018-*`、`adr/075-*`                                                          | 1h       |
| 6   | `AgentDefinition` 双重定义解决 — 两个契约定义不兼容字段集                                                     | `contracts/agent_contract.md`、`contracts/agent_definition_lifecycle_contract.md` | 1h       |
| 7   | 事件命名格式统一 — 点号 vs 冒号                                                                               | `contracts/event_bus_contract.md`、`contracts/typed_event_bus_contract.md`        | 0.5h     |

#### P1 — 应尽快修复（过时内容，可能导致混淆）

| #   | 修复项                                                    | 涉及文件                                            | 预估工时 |
| --- | --------------------------------------------------------- | --------------------------------------------------- | -------- |
| 8   | `01-code-structure.md` 文件列表更新                       | `architecture/01-code-structure.md`                 | 2h       |
| 9   | `02-code-architecture-reference.md` 测试数统一 + 路径修正 | `architecture/02-code-architecture-reference.md`    | 1h       |
| 10  | `implementation_plan.md` 路径更新                         | `operations/implementation_plan.md`                 | 2h       |
| 11  | `contributing.md` 断链修复                                | `guides/contributing.md` 行 9                       | 0.1h     |
| 12  | ADR 超时状态标注（003→Superseded, 018→Superseded）        | `adr/003-*`、`adr/018-*`、`adr/007-*`               | 0.5h     |
| 13  | 记忆层命名三套方案统一                                    | `adr/003-*`、`adr/020-*`、`architecture/00-*` §29.2 | 1h       |
| 14  | 16 个桩契约补充内容                                       | `contracts/` 16 个文件                              | 8h       |
| 15  | 6 对重叠契约合并                                          | `contracts/` 12 个文件                              | 6h       |
| 16  | `source_of_truth.md` 更新                                 | `governance/source_of_truth.md`                     | 0.5h     |
| 17  | `00-full-coverage-test-manual.md` 路径更新                | `quality/00-full-coverage-test-manual.md`           | 2h       |

#### P2 — 建议修复（改善文档质量）

| #   | 修复项                                                      | 涉及文件                                                      | 预估工时 |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------- | -------- |
| 18  | `00-platform-architecture.md` §35 标注"计划中"目录          | `architecture/00-platform-architecture.md`                    | 0.5h     |
| 19  | `04-runtime-sequence.md` 数量修正 + 路径修正                | `architecture/04-runtime-sequence.md`                         | 0.3h     |
| 20  | ADR 格式统一（38 个文件）                                   | `adr/` 全部                                                   | 4h       |
| 21  | Runbook 补充平台特定内容                                    | `operations/runbooks/` 5 个文件                               | 4h       |
| 22  | 迁移文档标注为历史文档                                      | `migration/` 2 个文件                                         | 0.5h     |
| 23  | `glossary_and_terminology.md` 编号修正                      | `governance/glossary_and_terminology.md`                      | 0.3h     |
| 24  | 新建 `guides/README.md`                                     | `guides/`                                                     | 0.2h     |
| 25  | 缺失契约创建（cache, model-gateway, prompt-engine, SDK）    | `contracts/` 4-5 个新文件                                     | 6h       |
| 26  | 测试数量统一为动态引用                                      | 3 个文件                                                      | 1h       |
| 27  | `operations-tracker.md` 删除或合并                          | `operations/`                                                 | 0.1h     |
| 28  | 契约命名和语言统一                                          | `contracts/` 3 个文件                                         | 1h       |
| 29  | `00-platform-architecture.md` §44→§46、§57→§59 编号间隙处理 | `architecture/00-platform-architecture.md`                    | 1h       |
| 30  | `operations-checklist.md` 测试数更新                        | `operations/operations-checklist.md`                          | 0.1h     |
| 31  | ADR-003 文件名修正                                          | `adr/003-memory-seven-layers.md` → `003-memory-six-layers.md` | 0.1h     |

#### 修复路线图

| 阶段             | 时间       | 目标                              | 文件数   |
| ---------------- | ---------- | --------------------------------- | -------- |
| Sprint 1（3 天） | W1 前半    | P0 全部 7 项修复                  | ~10 文件 |
| Sprint 2（5 天） | W1 后半-W2 | P1 前 7 项（#8-#14）              | ~25 文件 |
| Sprint 3（5 天） | W2-W3      | P1 后 3 项（#15-#17）+ P2 前 5 项 | ~20 文件 |
| Sprint 4（5 天） | W3-W4      | P2 剩余项                         | ~15 文件 |

**总预估工时**: ~46 小时（约 6 个工作日）

---

> **文档审查结论**: 165 个文档中发现 106 个问题，其中 19 个为严重问题。最核心的问题是 `03-module-diagrams.md` 全文过时（使用不存在的 `ai-ops` 路径前缀）、`project_structure_contract.md` 声明的项目结构与实际代码完全不匹配、以及 `src_module_test_matrix.md` 全部 1,455 行引用旧路径。建议在 2 个 Sprint（约 8 个工作日）内完成 P0+P1 修复，消除所有误导性文档内容。
