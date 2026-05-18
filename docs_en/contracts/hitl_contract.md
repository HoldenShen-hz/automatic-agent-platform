# HITL Contract

## 1. Scope

Defines Human-in-the-Loop requests, decisions, and recovery closed loop.

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

- High/critical risk actions must be traceable to HITL decisions or explicit policy exemptions.
- All HITL results must write back fact events and audit references.
- After takeover ends, canonical runtime state must be explicitly restored.
