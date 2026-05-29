# API Surface Contract

---

## OAPEFLIR 关联

本 contract 参vs OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集vs聚合
- **Assess**：执lines前评估vs风险判断
- **Plan**：任务分解vs DAG 构建
- **Execute**：步骤执linesvs容错
- **Feedback**：信号收集vs预handle
- **Learn**：模式检测vs知识提取
- **Improve**：改进候选评估vs rollout
- **Release**：受控发布vs回滚

---

## 1. 范围

本 contract defines平台对外 HTTP API 的最小资源模型和接口边界。

相关 companion：

- `sdk_surface_contract.md` 负责 CLI / Client SDK / Pack SDK / Plugin SDK 对外table面
- `docs_zh/reference/api-versioning.md` 负责人工Description和版本协商口径

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

若平台后续暴露独立执linesControl Plane，可额外提供：

- `POST /command/exec`
- `POST /command/exec/:processId/write`
- `POST /command/exec/:processId/resize`
- `POST /command/exec/:processId/terminate`

## 4. lines为约束

- API 返回结构必须vs contract 命名对齐。
- 写接口必须返回稳定 ID vstime戳。

## v4.3 Contract Remediation

- T-61: 本文原先把 `/executions/:executionId/inspect` 写成唯一 canonical inspect 入口，Root cause:  API contract accesses along用了旧 execution-centric 观测模型，没有随着 `HarnessRun / NodeRun` 真相主链升级。修复：本文现把 `harness-runs` / `node-runs` inspect 提升为权威端点，`/executions/:executionId/inspect` 只保留兼容查询语义。
- 高风险动作应要求审批或明确permission。
- OpenAPI 应由 schema 生成，不维护手写漂移版本。
- health / inspect 的Status语义vs字段命名以 `debug_inspect_health_backpressure_contract.md` 为准。
- CLI、Web Console、TUI、manage工具若消费同一服务面，应优先共享同一 versioned API / SDK surface，而不iseach维护隐式私有协议。
- rollout / feedback / timeline class接口若当前部署未enabled相应能力，应返回显式 `not_enabled` 或受控 `404` 语义，不得assuccess空对象。
- knowledge / domain / plugin / artifact plane 接口若当前部署未enabled相应能力，应返回显式 `not_enabled`，而不is静默空列table。

受控Status码映射：

| 场景 | Status码 | 稳定错误码 |
|---|-------|--------|
| 资源don't exist / 能力未enabled且允许受控空洞 | `404` | `api.task_not_found` 等 resource-specific code |
| 幂等键conflicts / repeatsrequest | `409` | `api.idempotency_key_conflict` / `api.duplicate_request` |
| request体exceeds限 | `413` | `api.payload_too_large` |
| 媒体class型不supported | `415` | `api.unsupported_media_type` |
| 限流 | `429` | `api.rate_limit_exceeded` |

## 5. 补充规则

### 5.1 鉴权

- `POST /tasks`、`POST /approvals/:approvalId/decision`、取消class接口defaults to要求已authentication主体。
- `GET /healthz` 可允许受限匿名访问；`GET /health` only兼容别名。
- `inspect` class接口defaults to要求manage员、任务所有者或具备显式调试permission的主体。

### 5.2 分页vs过滤

- 列table接口统一uses `limit`、`cursor`、`sort`。
- 过滤字段uses显式白名单，不accepts任意字段透传。
- defaults to排序应稳定，避免分页漂移。
- knowledge query 至少应supported `q`、`namespace?`、`domainId?`、`limit?`；当 semantic backend enabled时，call方不需要理解底层is `local_hash` 还is `pgvector`。
- `GET /knowledge/semantic/inspect` 应返回当前 semantic backend、readiness vs后端细节；显式enabled `pgvector` 但后端不可用时，runtime 启动应 fail-close。

### 5.3 版本演进

- 外部 API defaults touses `/v1` 前缀或等价版本策略。
- 破坏性字段变更必须走新版本或新增字段兼容期。
- OpenAPI 生成物is派生品，事实源仍在 contract vs schema。

### 5.4 SDK vs嵌入式消费面

- typed client、server bootstrap helper、admin SDK 都应从同一 schema / OpenAPI 派生。
- 平台允许存在 CLI / TUI / Web 等不同客户端，但它们不应via复制接口defines来分叉事实源。
- 若某客户端需要 transport 或 header 重写等适配逻辑，应视为客户端兼容层，而不is API contract 本身。
- 若 SDK relies on特定 runtime / CLI 二进制，应显式声明版本关系或 pinning 规则，而不is隐式假设“user本地正好兼容”。

### 5.5 独立执linesControl Plane

- standalone `command/exec` 若存在，应被视为受控Control Plane能力，而不is普通 task 执lines的捷径。
- 它必须显式声明 `sandboxPolicy`、`timeout`、`output cap`、`pty/streaming` 等执lines控制项。
- command/exec 产生的进程控制Status不得反向篡改 task / workflow 主Status。

### 5.6 Plugin Registry Inventory

- `GET /plugins` vs `GET /domains/:domainId/plugins` 至少应返回 `manifest`、`lifecycle_state`、`failure_count`、`cooldown_until?`、`runtime_process_id?`。
- 若 plugin 运lines在独立 sandbox runtime，还应暴露 `runtime_sandbox_root?` 供 diagnostics / operator 审计。
