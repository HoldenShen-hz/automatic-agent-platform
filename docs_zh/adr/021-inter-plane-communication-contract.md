# ADR-021 平面间通信契约

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

平台五平面（P1 接口面、P2 控制面、P3 编排面、P4 执行面、P5 状态与证据面）之间需要标准化通信协议。若各平面自行定义契约，会导致集成脆弱、边界模糊、审计困难。

## 决策

### RequestEnvelope 契约（8 字段）

所有跨平面调用必须包装在 RequestEnvelope 中：

```typescript
interface RequestEnvelope {
  trace_id: string;           // 全链路追踪 ID
  idempotency_key?: string;    // 幂等键，防止重复调用
  principal: Principal;        // 调用方身份
  source_plane: PlaneId;       // 来源平面
  target_plane: PlaneId;       // 目标平面
  directives: Array<OperationalDirective | DecisionDirective>;
  payload: unknown;            // 业务负载
  metadata?: Record<string, unknown>;
}
```

### `OperationalDirective` / `DecisionDirective` 契约

```typescript
type OperationalDirective =
  | { type: 'mode_switch'; runtime_mode: RuntimeMode }
  | { type: 'pause_run'; harnessRunId: string }
  | { type: 'resume_run'; harnessRunId: string }
  | { type: 'quota_adjust'; budgetLedgerId: string; delta: number }
  | { type: 'kill_run'; harnessRunId: string };

type DecisionDirective =
  | { type: 'approve'; approvalId: string }
  | { type: 'deny'; approvalId: string; reason?: string }
  | { type: 'expire_approval'; approvalId: string }
  | { type: 'request_manual_takeover'; harnessRunId: string; nodeRunId?: string };
```

### `PlanGraphBundle` 与 `NodeAttemptReceipt`

```typescript
interface PlanGraphBundle {
  planGraphBundleId: string;
  harnessRunId: string;
  graphVersion: number;
  budget: {
    max_steps: number;
    max_duration_ms: number;
    max_cost: number;
  };
  graph: PlanGraph;
  schedulerPolicy: SchedulerPolicy;
  validationReport: ValidationReport;
}

interface NodeAttemptReceipt {
  receiptId: string;
  nodeAttemptId: string;
  nodeRunId: string;
  status: NodeAttemptStatus;
  outputRef?: ArtifactRef;
  evidenceRefs: ArtifactRef[];
  budgetSettlementRefs: string[];
}
```

### 平面隔离规则

- P1 不得绕过 P2 直调 P4：所有 P1 请求必须经 PolicyCenterService.evaluate() 审批
- P5 不得向 P4 发出指令：state-evidence 层为只读，不对 execution/ 写入
- 全部契约对象含 principal + trace_id：通过 factory 函数强制
- `ControlDirective`、`ExecutionPlan`、`ExecutionReceipt` 只允许作为 legacy 名词出现在迁移或历史兼容层，不再作为 canonical P2→P3/P4 契约。

## 后果

优点：

- 统一契约使跨平面调用可追踪、可审计
- trace_id 使全链路排查成为可能
- 平面隔离规则防止越权调用

代价：

- 所有跨平面调用增加 envelope 包装开销
- contract 变更需要协调所有平面

## 交叉引用

- [ADR-001 三层分权架构](./001-three-layer-architecture.md)
- [ADR-004 工作流与路由](./004-workflow-routing.md)

## 来源章节

- `§5` 平面间通信契约

## v4.3 ADR Remediation

- A-13: 本 ADR 原先把 P2→P3 控制对象收敛成单一 `ControlDirective`，根因是早期设计把“操作性控制”和“审批/决策结果”混成一种跨平面消息。修复：正文现拆分为 `OperationalDirective` 与 `DecisionDirective`。
- A-14: 本 ADR 原先把 P3→P4 handoff 写成线性 `ExecutionPlan.steps[]`，根因是 ADR 形成时执行模型仍停留在线性 workflow 语义，没有随 v4.3 graph handoff 升级。修复：正文现改为 `PlanGraphBundle`。
- A-15: 本 ADR 原先把 P4→P3 结果写成聚合 `ExecutionReceipt`，根因是当时尚未把 node attempt 和回执 append-only 模型提炼为独立真相对象。修复：正文现改为 `NodeAttemptReceipt`，并带 `nodeAttemptId + nodeRunId`。
