# Risk Assessment Contract

## 1. Scope

Defines shared risk assessment objects for admission, planning, routing, and side-effect.

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

- Risk assessment must be traceable to the evidence chain at the run/node layer.
- high/critical risk must explicitly have mitigation or HITL constraints.
- Risk level must not exist only in UI text layer.