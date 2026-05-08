# ADR-040 目标分解引擎架构

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

复杂业务目标需要分解为可执行的任务序列，平台需要自动化的目标分解能力。

## 决策

### 核心接口

```typescript
interface Goal {
  goal_id: string;
  description: string;
  success_criteria: SuccessCriterion[];
  constraints: Constraint[];
  deadline?: string;
}

interface SuccessCriterion {
  criterion_id: string;
  description: string;
  metric: string;
  target_value: number;
}

interface GoalDecomposition {
  decomposition_id: string;
  goal_id: string;
  planned_tasks: PlannedTask[];
  confidence: number;
  requires_human_review: boolean;
}

interface PlannedTask {
  task_id: string;
  description: string;
  dependencies: string[];  // 依赖的任务 ID
  estimated_duration_minutes: number;
  domain_id?: string;
}

interface TaskDependency {
  from: string;
  to: string;
  type: 'sequential' | 'parallel' | 'conditional';
}
```

### 分解流程

1. 解析 Goal 的 success_criteria
2. 识别任务依赖关系
3. 构建 DAG（有向无环图）
4. 验证无循环依赖
5. 计算分解置信度

### 置信度阈值

```typescript
const CLARIFICATION_THRESHOLD = 0.7;  // 置信度 < 0.7 → 人工辅助
```

- `confidence < 0.7` 触发澄清
- `decompositionConfidence < 0.7` 标记 `requiresHumanReview: true`

### 深度限制

```typescript
const DEFAULT_MAX_DEPTH = 5;  // 最大分解深度 5 层
```

### GoalProjection 与 HarnessRun 生命周期关系

`Goal` 本身只描述分解输入；进入执行后，状态 truth 必须收敛到 `HarnessRun.status`。

| GoalProjection 状态 | 对应 HarnessRun truth |
|------|------|
| draft | 尚未创建 `HarnessRun` |
| decomposing | `created / admitted / planning` |
| planned | `ready` |
| executing | `running / replanning / compensating` |
| paused | `pausing / paused / resuming` |
| completed | `completed` |
| failed | `failed` |
| cancelled | `aborted` |

规则：

- `GoalProjection` 只允许作为上层投影或产品态显示，不得替代 `HarnessRun.status`。
- 不再单独定义与 `HarnessRun` 平行的 9 态 goal truth 生命周期。

### 循环依赖检测

- DependencyGraph + Validator
- 发现循环依赖时拒绝分解

## 后果

优点：

- 自动化分解提高效率
- 置信度机制平衡自动化与人工
- DAG 验证确保可执行性

代价：

- 复杂目标分解可能不准确
- 依赖关系分析

## v4.3 ADR Remediation

- A-28: 本 ADR 原先单独定义 9 态 goal lifecycle，根因是目标分解 ADR 把“分解产物状态”和“运行时 truth 状态”混成一套生命周期，没有随着 `HarnessRun` 成为唯一执行主状态机而收敛。修复：正文现把 goal 状态降为 `GoalProjection`，执行阶段统一映射到 `HarnessRun.status`。
