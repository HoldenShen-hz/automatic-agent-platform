# Runtime Sequence

> **最后更新**：2026-05-26
>
> 本文档描述当前 Automatic Agent Platform 的关键运行时主链，统一使用现行对象与目录命名，不再沿用老系统的 `WorkflowState / Phase1bOrchestrator / TransitionService` 叙事。

---

## 1. 任务准入 → Mission 解析 → HarnessRun 创建

```text
Client / UI / SDK
  -> P1 HTTP API (`task-routes` / `mission-routes`)
  -> P2 MissionResolver / MissionGovernanceService
  -> P3 IntakeAdmissionService
  -> P5 Truth Store + Event / Outbox append
  -> P3 Harness runtime bootstrap
```

关键步骤：

1. 调用方提交任务或 Mission 关联请求。
2. P1 完成认证、输入校验、tenant scope 解析。
3. P2 执行 Mission 解析、权限/风险/预算/策略交集校验。
4. P3 `IntakeAdmissionService` 生成 admission 链路对象，并创建或绑定 `HarnessRun`。
5. P5 同事务写入 truth + 事件事实；失败时整体回滚，不允许只落一半状态。

当前实现落点：

- `src/platform/five-plane-interface/api/http-server/task-routes.ts`
- `src/platform/five-plane-control-plane/mission/`
- `src/platform/five-plane-orchestration/harness/runtime/`
- `src/platform/five-plane-state-evidence/truth/`

---

## 2. Harness 编排 → Dispatch → Lease → Worker 执行

```text
HarnessRun
  -> Planner / Routing / Replan
  -> ExecutionDispatchService
  -> ExecutionLeaseService
  -> Worker Pool
  -> Execution Engine / Tool Executor / Plugin Executor
  -> Writeback with lease + fencing
```

关键步骤：

1. P3 根据 `PlanGraphBundle`、约束、风险与上下文做编排决策。
2. P4 `ExecutionDispatchService` 选择可执行 ticket 和 worker。
3. `ExecutionLeaseService` 分配 lease / fencing token，确保单权威写回。
4. Worker 执行 tool/plugin/browser/human-wait 等具体动作。
5. 执行结果通过 writeback 回到 truth store，使用 lease/fencing 做并发保护。

当前实现落点：

- `src/platform/five-plane-execution/dispatcher/`
- `src/platform/five-plane-execution/lease/`
- `src/platform/five-plane-execution/worker-pool/`
- `src/platform/five-plane-execution/execution-engine/`

---

## 3. 事件事实 → DurableEventBus → Consumer / DLQ

```text
Producer
  -> P5 truth mutation
  -> Event append / Outbox append
  -> DurableEventBus
  -> Consumer ack / retry
  -> DLQ on terminal failure
```

关键步骤：

1. 任何 Tier-1 状态变化先写 truth，再追加事件事实。
2. `DurableEventBus` 负责按层级把事件派发到 consumer。
3. consumer 失败不会再被 `DurableEventBusAsync` 静默吞掉，而是回到主链重试/告警/DLQ。
4. 达到失败边界后进入 DLQ，由后续重放或人工恢复处理。

当前实现落点：

- `src/platform/five-plane-state-evidence/events/`
- `src/platform/five-plane-state-evidence/dlq/`
- `src/platform/five-plane-state-evidence/outbox/`

---

## 4. Federation 审计 / Trust 治理主链

```text
Federation action
  -> FederationAudit.record()
  -> persistent snapshot / archive
  -> TrustRelationship evaluate / enforce
  -> expiry / reauth / revoke gate
```

关键步骤：

1. 联邦动作进入 `FederationAudit`，写入活动快照并按策略归档。
2. 查询时执行多条件交集过滤，而不是只按首个索引条件筛选。
3. `TrustRelationship` 在准入和评估时会检查 `expiresAt`、periodic reauth、status。
4. 过期、撤权、超窗未复验的 trust 不再仅影响评分，而是直接退出 active 可用态。

当前实现落点：

- `src/scale-ecosystem/federation/federation-audit.ts`
- `src/scale-ecosystem/federation/trust-relationship.ts`

---

## 5. UI 公共查询链路

```text
Web / Electron / Mobile
  -> shared api-client (`/v1/*`)
  -> runtime baseUrl = /api
  -> P1 Layer C routes
  -> MissionControl / Knowledge / Pack services
```

关键步骤：

1. 前端 endpoint catalog 统一定义 `/v1/*` 路径。
2. 运行时以 `baseUrl=/api` 拼接，最终访问 `/api/v1/*`。
3. 公共查询默认走 Layer C 路由，而不是 `/admin/*`。
4. 代表性公共接口包括：
   - `/v1/workers`
   - `/v1/queues`
   - `/v1/agents`
   - `/v1/dashboard/metrics`
   - `/v1/explanations`
   - `/v1/meta/contract-version`
   - `/v1/knowledge`
   - `/v1/marketplace`
   - `/v1/packs/:packId/versions`
   - `/v1/workflows/builder`

当前实现落点：

- `ui/packages/shared/api-client/src/endpoints.ts`
- `src/platform/five-plane-interface/api/http-server/dashboard-routes.ts`
- `src/platform/five-plane-interface/api/http-server/plane-routes.ts`
- `src/platform/five-plane-interface/api/http-server/pack-routes.ts`
- `src/platform/five-plane-interface/api/http-server/task-routes.ts`

---

## 6. Electron 平台桥接链路

```text
Electron preload
  -> exposeInMainWorld("AA_ELECTRON")
  -> exposeInMainWorld("__AA_ELECTRON__")
  -> desktop-platform-adapter resolve bridge
  -> shared platform APIs
```

关键步骤：

1. preload 暴露双名称 bridge，兼容历史调用方和当前 adapter。
2. `desktop-platform-adapter` 优先读取 `__AA_ELECTRON__`，并兼容 `AA_ELECTRON`。
3. secure storage、deep link、shell、windowing 等桌面能力统一经 PlatformAdapter 注入。

当前实现落点：

- `ui/apps/electron-win/src/preload.ts`
- `ui/packages/shared/platform/src/desktop-platform-adapter.ts`
- `ui/packages/shared/platform/src/bridge-types.ts`

---

## 7. 当前阅读建议

1. 看“任务怎么进系统”，先读 `01-code-structure.md` 中的 P1/P2/P3 对应章节，再看本文件第 1、2 节。
2. 看“状态和事件怎么闭环”，先读本文件第 3 节，再看 `03-module-diagrams.md` 的 P4/P5 图。
3. 看“前端怎么接后端”，先读本文件第 5、6 节，再看 `05-cross-platform-ui-architecture.md`。
