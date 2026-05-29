# HITL Contract

## 1. 范围

defines Human-in-the-Loop request、Decisionvs恢复闭环。

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

- high/critical 风险动作必须可追溯到 HITL Decision或显式政策豁免。
- 所有 HITL 结果都必须回写事实事件vs审计references用。
- takeover 结束后必须显式恢复到 canonical runtime Status。

