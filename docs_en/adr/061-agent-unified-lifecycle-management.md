# ADR-061 Agent 统一生命cyclemanageArchitecture

- Status：Accepted
- Decision日期：2026-04-20

## Background

Agent 由多个松散组件组合而成，缺乏统一的版本和生命cyclemanage。

## Decision

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

### 生命cycleStatus（§61.3 reconciliation）

| Status | Description |
|------|------|
| draft | 草稿 |
| testing | 测试中 |
| staging | 预发布 |
| canary | 金丝雀放量中 |
| active | 当前活跃版本 |
| paused | 暂停推进 |
| deprecated | 已废弃 |
| archived | 归档 |
| removed | 已移除（终态） |

约束：
- Status流转顺序：draft → testing → staging → canary → active → paused → deprecated → archived → removed
- `canary` vs `active` 分别对应受控放量和defaults to活跃版本，不再uses `production / retired / superseded` 混合table达。
- archived Status保留审计历史，不可逆回活跃态。
- removed 为终态，table示运lines面vs投影面都completed清理。

## v4.3 ADR Remediation

- R3-52: 本 ADR 曾accesses along用 `requirements_locked / production / retired / superseded` 这组历史词汇，未vs §61.3 的 rollout lifecycle 对齐。修复：正文现统一到 `draft / testing / staging / canary / active / paused / deprecated / archived / removed` 九态生命cycle。

- Semantic versioning (major.minor.patch)
- 版本兼容性检查
- 降级supported

### 部署manage

- 蓝绿部署
- 金丝雀发布
- 回滚能力

### 组件relies on

- relies on关系图
- 版本兼容性矩阵
- 升级Impact分析

## Consequences

优点：

- 统一manage提高可维护性
- 版本化supported回滚
- relies onmanage防止conflicts

代价：

- 组件版本协调复杂
- 生命cycleStatus机维护成本

## 交叉references用

- [ADR-075 六级受控发布vs Rollout Status机](./075-controlled-rollout-release.md)
- [ADR-029 OAPEFLIR 受控认知内核](./029-oapeflir-controlled-cognition-kernel.md)

## 来源章节

- `§61` Agent 统一生命cyclemanageArchitecture
