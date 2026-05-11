# HITL Contract

## 1. Scope

Defines the Human-in-the-Loop request, decision, and recovery closed loop.

## 2. Core Objects

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

## 3. Constraints

- High/critical risk actions must be traceable to an HITL decision or an explicit policy exemption.
- All HITL results must be written back to truth events with audit references.
- After takeover ends, the system must explicitly resume canonical runtime state.
