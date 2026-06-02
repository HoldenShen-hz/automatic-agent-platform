# Evidence Chain Contract

## 1. Scope

Defines the object model of the runtime evidence chain, covering artifacts, fact events, audit references, and verification hashes.

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

- Any replayable / auditable conclusion must be traceable to a `harnessRunId`.
- When `nodeRunId` is missing, it must be stated that the evidence belongs at run level rather than node level.
- The evidence chain must not depend solely on `taskId` / `executionId`.
