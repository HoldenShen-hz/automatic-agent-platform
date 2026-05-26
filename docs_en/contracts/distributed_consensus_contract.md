# Distributed Consensus Contract

## 1. Scope

Defines canonical objects, voting constraints, and failure semantics for cross-node consensus decision-making, covering leader election, write gatekeeper, quorum, and read-only degradation.

## 2. Core Objects

```typescript
interface ConsensusEpoch {
  epochId: string;
  clusterId: string;
  leaderNodeId: string | null;
  term: number;
  quorumSize: number;
  committedAt: string | null;
}

interface ConsensusVote {
  voteId: string;
  epochId: string;
  voterNodeId: string;
  candidateNodeId: string;
  granted: boolean;
  reasonCode: string | null;
  occurredAt: string;
}
```

## 3. Constraints

- Any authoritative write must be initiated by the current `ConsensusEpoch.leaderNodeId`.
- When quorum is not satisfied, may only enter read-only or pause, must not have dual-master writes.
- `term` monotonically increases; write requests from old term must fail-close.