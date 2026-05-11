# Distributed Consensus Contract

## 1. Scope

Defines canonical objects, voting constraints, and failure semantics for cross-node consistent decision-making, covering leader election, write barrier, quorum, and read-only degradation.

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

- All authoritative writes must be initiated by the current `ConsensusEpoch.leaderNodeId`.
- When quorum is not satisfied, the system may only enter read-only mode or pause; dual-master writes are prohibited.
- `term` must monotonically increase; write requests from old terms must fail-close.
