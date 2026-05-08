# API Surface Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 rollout
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义平台对外 HTTP API 的最小资源模型和接口边界。

## 2. 资源对象

- `TaskResource`
- `SessionResource`
- `ApprovalResource`
- `DivisionResource`
- `HealthResource`
- `FeedbackResource`
- `StrategyVersionResource`
- `RolloutResource`
- `KnowledgeNamespaceResource`
- `PluginRegistryResource`
- `ArtifactPublishResource`

## 3. 最小 endpoint 集合

- `POST /tasks`
- `GET /tasks/:taskId`
- `GET /tasks/:taskId/events`
- `GET /tasks/:taskId/inspect`
- `GET /tasks/:taskId/oapeflir-timeline`
- `POST /tasks/:taskId/cancel`
- `GET /sessions/:sessionId/messages`
- `GET /harness-runs/:harnessRunId/inspect`
- `GET /node-runs/:nodeRunId/inspect`
- `GET /executions/:executionId/inspect` (legacy compat alias)
- `GET /approvals/:approvalId/inspect`
- `POST /approvals/:approvalId/decision`
- `GET /rollouts/:rolloutId/inspect`
- `POST /rollouts/:rolloutId/advance`
- `POST /rollouts/:rolloutId/rollback`
- `GET /feedback/:taskId`
- `GET /divisions`
- `GET /knowledge/namespaces`
- `GET /knowledge/query`
- `GET /knowledge/graph`
- `GET /knowledge/semantic/inspect`
- `GET /knowledge/:namespace/inspect`
- `GET /domains`
- `GET /domains/:domainId`
- `GET /domains/:domainId/plugins`
- `GET /plugins`
- `GET /artifacts/publishes`
- `POST /artifacts/bundles/preview`
- `POST /artifacts/bundles/publish`
- `GET /healthz`
- `GET /health` (compat alias)

若平台后续暴露独立执行控制面，可额外提供：

- `POST /command/exec`
- `POST /command/exec/:processId/write`
- `POST /command/exec/:processId/resize`
- `POST /command/exec/:processId/terminate`

## 4. 行为约束

- API 返回结构必须与 contract 命名对齐。
- 写接口必须返回稳定 ID 与时间戳。

## v4.3 Contract Remediation

- T-61: 本文原先把 `/executions/:executionId/inspect` 写成唯一 canonical inspect 入口，根因是 API contract 沿用了旧 execution-centric 观测模型，没有随着 `HarnessRun / NodeRun` 真相主链升级。修复：本文现把 `harness-runs` / `node-runs` inspect 提升为权威端点，`/executions/:executionId/inspect` 只保留兼容查询语义。
- 高风险动作应要求审批或明确权限。
- OpenAPI 应由 schema 生成，不维护手写漂移版本。
- health / inspect 的状态语义与字段命名以 `debug_inspect_health_backpressure_contract.md` 为准。
- CLI、Web Console、TUI、管理工具若消费同一服务面，应优先共享同一 versioned API / SDK surface，而不是各自维护隐式私有协议。
- rollout / feedback / timeline 类接口若当前部署未启用相应能力，应返回显式 `not_enabled` 或受控 `404` 语义，不得伪装成成功空对象。
- knowledge / domain / plugin / artifact plane 接口若当前部署未启用相应能力，应返回显式 `not_enabled`，而不是静默空列表。

## 5. 补充规则

### 5.1 鉴权

- `POST /tasks`、`POST /approvals/:approvalId/decision`、取消类接口默认要求已认证主体。
- `GET /healthz` 可允许受限匿名访问；`GET /health` 仅兼容别名。
- `inspect` 类接口默认要求管理员、任务所有者或具备显式调试权限的主体。

### 5.2 分页与过滤

- 列表接口统一使用 `limit`、`cursor`、`sort`。
- 过滤字段使用显式白名单，不接受任意字段透传。
- 默认排序应稳定，避免分页漂移。
- knowledge query 至少应支持 `q`、`namespace?`、`domainId?`、`limit?`；当 semantic backend 启用时，调用方不需要理解底层是 `local_hash` 还是 `pgvector`。
- `GET /knowledge/semantic/inspect` 应返回当前 semantic backend、readiness 与后端细节；显式启用 `pgvector` 但后端不可用时，runtime 启动应 fail-close。

### 5.3 版本演进

- 外部 API 默认使用 `/v1` 前缀或等价版本策略。
- 破坏性字段变更必须走新版本或新增字段兼容期。
- OpenAPI 生成物是派生品，事实源仍在 contract 与 schema。

### 5.4 SDK 与嵌入式消费面

- typed client、server bootstrap helper、admin SDK 都应从同一 schema / OpenAPI 派生。
- 平台允许存在 CLI / TUI / Web 等不同客户端，但它们不应通过复制接口定义来分叉事实源。
- 若某客户端需要 transport 或 header 重写等适配逻辑，应视为客户端兼容层，而不是 API contract 本身。
- 若 SDK 依赖特定 runtime / CLI 二进制，应显式声明版本关系或 pinning 规则，而不是隐式假设“用户本地正好兼容”。

### 5.5 独立执行控制面

- standalone `command/exec` 若存在，应被视为受控控制面能力，而不是普通 task 执行的捷径。
- 它必须显式声明 `sandboxPolicy`、`timeout`、`output cap`、`pty/streaming` 等执行控制项。
- command/exec 产生的进程控制状态不得反向篡改 task / workflow 主状态。

### 5.6 Plugin Registry Inventory

- `GET /plugins` 与 `GET /domains/:domainId/plugins` 至少应返回 `manifest`、`lifecycle_state`、`failure_count`、`cooldown_until?`、`runtime_process_id?`。
- 若 plugin 运行在独立 sandbox runtime，还应暴露 `runtime_sandbox_root?` 供 diagnostics / operator 审计。
