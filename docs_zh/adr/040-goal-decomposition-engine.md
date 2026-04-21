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

### 9 种目标生命周期状态

| 状态 | 说明 |
|------|------|
| draft | 草稿 |
| decomposing | 分解中 |
| planned | 已计划 |
| executing | 执行中 |
| paused | 暂停 |
| completed | 完成 |
| failed | 失败 |
| cancelled | 取消 |
| expired | 超时 |

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