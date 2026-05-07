# Risk Assessment Contract

## 1. 范围

定义 admission、planning、routing、side-effect 共享的风险评估对象。

## 2. 核心对象

```typescript
interface RiskAssessment {
  assessmentId: string;
  tenantId: string;
  harnessRunId: string | null;
  nodeRunId: string | null;
  riskClass: "low" | "medium" | "high" | "critical";
  factors: string[];
  mitigationRefs: string[];
}
```

## 3. 约束

- 风险评估必须能在 run/node 层关联到事实链。
- high/critical 必须显式有 mitigation 或 HITL 约束。
- 风险等级不得只存在 UI 文案层。

