# Evidence Chain Contract

## 1. Scope

Define the object model for runtime evidence chain, covering artifact, fact event, audit reference and verification hash.

## 2. Core Objects

```typescript
interface EvidenceChainLink {
  evidenceId: string;
  harnessRunId: string;
  nodeRunId: string | null;
  sourceType: "artifact" | "event" | "audit" | "projection";
  sourceRef: string;
  hash: string | null;
  occurredAt: string;
}
```

## 3. Constraints

- Any replayable/auditable conclusion must be traceable to `harnessRunId`.
- When `nodeRunId` is missing, must explain that this evidence belongs to run level not node level.
- Evidence chain must not rely only on `taskId` / `executionId`.
