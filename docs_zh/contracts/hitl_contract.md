# HITL Contract

## 1. 范围

定义 Human-in-the-Loop 请求、决策与恢复闭环。

## 2. 核心对象

```typescript
interface HitlDecisionRequest {
  requestId: string;
  harnessRunId: string;
  nodeRunId: string | null;
  riskClass: "low" | "medium" | "high" | "critical";
  decisionType: "approve" | "reject" | "clarify" | "takeover";
  createdAt: string;
}
```

## 3. 约束

- high/critical 风险动作必须可追溯到 HITL 决策或显式政策豁免。
- 所有 HITL 结果都必须回写事实事件与审计引用。
- takeover 结束后必须显式恢复到 canonical runtime 状态。

