# ADR-047 组织架构审批路由

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

审批请求需要根据组织架构动态路由到正确的审批人，而不是硬编码的审批链路。

## 决策

### ApproverRule

```typescript
interface ApproverRule {
  rule_id: string;
  name: string;
  condition: ApprovalCondition;
  approver_type: ApproverType;
  escalation_path?: string[];
}

type ApproverType = 'user' | 'role' | 'team' | 'on_call';
```

### ApprovalFlow 类型

| 类型 | 说明 |
|------|------|
| single | 单人审批 |
| multi_party | 多方会签 |
| delegated | 委托审批 |
| sequential_chain | 顺序审批链 |

### ApprovalTimeout 策略

| 策略 | 说明 |
|------|------|
| warn | 超时前警告 |
| escalate | 超时后升级 |
| auto_action | 超时后自动执行预设动作 |

注：auto_action 执行须遵循 §10.3 风险级别守卫——high/critical 风险级别默认 deny，auto_action 不得在未经显式审批的情况下自动执行高风险操作。§2.1 审批延迟时应"安全停住"而非自动执行，critical 操作要求 break-glass + 双人审批机制。

### 路由规则引擎

- 基于组织层级、角色、风险等级动态路由
- 支持审批委托
- 支持审批加急

## 后果

优点：

- 动态路由适应组织变化
- 多类型审批流支持复杂场景
- 超时处理自动化

代价：

- 规则引擎复杂度
- 路由性能影响

## 交叉引用

- [ADR-046 组织层次模型](./046-organization-hierarchy-model.md)
- [Approval / HITL Contract](../contracts/approval_and_hitl_contract.md)

## 来源章节

- `§47` 组织架构审批路由
