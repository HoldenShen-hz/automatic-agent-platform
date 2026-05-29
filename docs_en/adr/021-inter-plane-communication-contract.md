# ADR-021 平面间communication契约

- Status：Accepted
- Decision日期：2026-04-03

## Background

平台Five-Plane（P1 Interface Plane、P2 Control Plane、P3 Orchestration Plane、P4 Execution Plane、P5 StatusvsEvidence Plane）之间需要标准化communication协议。若各平面自linesdefines契约，会导致集成脆弱、边界模糊、审计困难。

## Decision

### RequestEnvelope 契约（8 字段）

所有跨平面call必须包装在 RequestEnvelope 中：

```typescript
interface RequestEnvelope {
  trace_id: string;           // 全链路追踪 ID
  idempotency_key?: string;    // 幂等键，防止repeatscall
  principal: Principal;        // call方身份
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

### `PlanGraphBundle` vs `NodeAttemptReceipt`

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

- P1 不得bypassing P2 直调 P4：所有 P1 request必须via PolicyCenterService.evaluate() 审批
- P5 不得向 P4 发出指令：state-evidence 层为只读，不对 execution/ writes
- 全部契约对象含 principal + trace_id：via factory functionmandatory
- `ControlDirective`、`ExecutionPlan`、`ExecutionReceipt` 只允许作为 legacy 名词出现在迁移或历史兼容层，不再作为 canonical P2→P3/P4 契约。

## Consequences

优点：

- 统一契约使跨平面call可追踪、可审计
- trace_id 使全链路排查成为可能
- 平面隔离规则防止越权call

代价：

- 所有跨平面call增加 envelope 包装开销
- contract 变更需要协调所有平面

## 交叉references用

- [ADR-001 三层分权Architecture](./001-three-layer-architecture.md)
- [ADR-004 工作流vs路由](./004-workflow-routing.md)

## 来源章节

- `§5` 平面间communication契约

## v4.3 ADR Remediation

- A-13: 本 ADR 原先把 P2→P3 控制对象收敛成单一 `ControlDirective`，Root cause: 早期设计把“操作性控制”和“审批/Decision结果”混成一种跨平面消息。修复：正文现拆分为 `OperationalDirective` vs `DecisionDirective`。
- A-14: 本 ADR 原先把 P3→P4 handoff 写成线性 `ExecutionPlan.steps[]`，Root cause:  ADR 形成时执lines模型仍停留在线性 workflow 语义，没有随 v4.3 graph handoff 升级。修复：正文现改为 `PlanGraphBundle`。
- A-15: 本 ADR 原先把 P4→P3 结果写成聚合 `ExecutionReceipt`，Root cause: 当时尚未把 node attempt 和回执 append-only 模型提炼为独立真相对象。修复：正文现改为 `NodeAttemptReceipt`，并带 `nodeAttemptId + nodeRunId`。
