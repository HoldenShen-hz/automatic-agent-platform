# ADR-041 主动式 Agent 框架

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

Agent 不能只能被动响应请求，还需要能主动感知环境变化并采取行动。

## 决策

### TriggerDefinition

```typescript
interface TriggerDefinition {
  trigger_id: string;
  name: string;
  type: TriggerType;
  condition: TriggerCondition;
  action: TriggerAction;
  max_fire_rate: number;
  enabled: boolean;
}

type TriggerType = 'schedule' | 'event' | 'threshold' | 'webhook_inbound';
```

### TriggerAction

| Action 类型 | 说明 |
|-------------|------|
| create_task | 创建任务（必须经过 intake pipeline） |
| create_goal | 创建目标 |
| suggest_to_user | 向用户建议 |
| update_dashboard | 更新看板 |

### 触发风暴保护（4 层）

| 层级 | 机制 |
|------|------|
| 每触发器速率限制 | 默认 10 次/小时 |
| 冷却期 | 默认 5 分钟 |
| 熔断器 | 3 次连续失败 = 禁用 |
| 每域每日预算 | dailyTriggerBudgetByDomain |

### TriggerEngine

- `proactive-agent/` (5 文件, 694 行)
- 评估触发条件
- 执行触发动作
- 记录触发历史

## 后果

优点：

- 主动感知提高平台智能化
- 多层保护防止触发风暴
- 多种触发类型覆盖常见场景

代价：

- 主动行为可能打扰用户
- 触发逻辑复杂度较高

## 交叉引用

- [ADR-039 自然语言任务入口架构](./039-natural-language-task-entry.md)
- [ADR-083 主动式 Agent 与渐进式自主权](./083-proactive-agent-and-progressive-autonomy.md)

## 来源章节

- `§41` 主动式 Agent 框架
