# Evidence Chain Contract

## 1. Scope

Defines the object model for the runtime evidence chain, covering artifacts, fact events, audit references, and verification hashes.

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

- Any replayable or auditable conclusion must be traceable to `harnessRunId`.
- When `nodeRunId` is missing, it must be documented that the evidence belongs to the run level rather than the node level.
- The evidence chain must not rely solely on `taskId` / `executionId`.

