# Risk Assessment Contract

## 1. Scope

Defines the shared risk assessment object for admission, planning, routing, and side-effect domains.

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

- Risk assessments must be linkable to the evidence chain at the run/node level.
- high/critical must have explicit mitigation or HITL constraints.
- Risk levels must not exist only at the UI copy layer.
