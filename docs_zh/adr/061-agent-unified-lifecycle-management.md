# ADR-061 Agent 统一生命周期管理架构

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

Agent 由多个松散组件组合而成，缺乏统一的版本和生命周期管理。

## 决策

### Agent 实体模型

```typescript
interface AgentEntity {
  agent_id: string;
  name: string;
  version: SemanticVersion;
  components: AgentComponent[];
  lifecycle_state: AgentLifecycleState;
  created_at: string;
  updated_at: string;
  deployed_at?: string;
}

interface AgentComponent {
  component_id: string;
  type: ComponentType;
  version: string;
  config: unknown;
}
```

### 生命周期状态

| 状态 | 说明 |
|------|------|
| draft | 草稿 |
| testing | 测试中 |
| staging | 预发布 |
| production | 生产 |
| deprecated | 废弃 |
| retired | 退役 |

### 版本管理

- Semantic versioning (major.minor.patch)
- 版本兼容性检查
- 降级支持

### 部署管理

- 蓝绿部署
- 金丝雀发布
- 回滚能力

### 组件依赖

- 依赖关系图
- 版本兼容性矩阵
- 升级影响分析

## 后果

优点：

- 统一管理提高可维护性
- 版本化支持回滚
- 依赖管理防止冲突

代价：

- 组件版本协调复杂
- 生命周期状态机维护成本

## 交叉引用

- [ADR-075 六级受控发布与 Rollout 状态机](./075-controlled-rollout-release.md)
- [ADR-029 OAPEFLIR 受控认知内核](./029-oapeflir-controlled-cognition-kernel.md)

## 来源章节

- `§61` Agent 统一生命周期管理架构
