# Distributed Consensus Contract

## 1. 范围

定义跨节点一致性决策的 canonical 对象、投票约束与失败语义，覆盖 leader 选举、写门禁、仲裁与只读降级。

## 2. 核心对象

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

## 3. 约束

- 任何权威写必须由当前 `ConsensusEpoch.leaderNodeId` 发起。
- quorum 未满足时只能进入只读或暂停，不得双主写入。
- `term` 单调递增；旧 term 的写请求必须 fail-close。

