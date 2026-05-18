# Risk Assessment Contract

## 1. Scope

Defines risk assessment objects shared by admission, planning, routing, and side-effect.

## 2. Core Objects

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

## 3. Constraints

- Risk assessment must be traceable to ground truth chain at run/node level.
- high/critical must explicitly have mitigation or HITL constraints.
- Risk class must not exist only at UI text layer.
