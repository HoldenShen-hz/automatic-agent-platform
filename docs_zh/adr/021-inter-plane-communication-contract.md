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
  control_directives: ControlDirective[];
  payload: unknown;            // 业务负载
  metadata?: Record<string, unknown>;
}
```

### ControlDirective 契约（6 种 type）

```typescript
type ControlDirective =
  | { type: 'mode_switch'; mode: PolicyMode }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'rollback'; target_state?: string }
  | { type: 'quota_adjust'; delta: number }
  | { type: 'kill' };
```

### ExecutionPlan 与 ExecutionReceipt

```typescript
interface ExecutionPlan {
  plan_id: string;
  budget: {
    max_steps: number;
    max_duration_ms: number;
    max_cost: number;
  };
  steps: Step[];
  precondition?: Precondition[];
}

interface ExecutionReceipt {
  receipt_id: string;
  plan_id: string;
  status: ExecutionStatus;
  outputs: StepOutput[];
  metrics: ExecutionMetrics;
}
```

### 平面隔离规则

- P1 不得绕过 P2 直调 P4：所有 P1 请求必须经 PolicyCenterService.evaluate() 审批
- P5 不得向 P4 发出指令：state-evidence 层为只读，不对 execution/ 写入
- 全部契约对象含 principal + trace_id：通过 factory 函数强制

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
