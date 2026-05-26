export interface MemoryReviewVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useMemoryReviewVm(): MemoryReviewVm {
  return {
    items: [
      { title: "Pending L5/L7 Memories", description: "查看待审核的高层记忆提案、敏感级别和来源证据。" },
      { title: "Revoke / Quarantine", description: "对错误或敏感记忆执行撤销、隔离和投影失效处理。" },
      { title: "Evidence Lineage", description: "从提案直接跳转到底层 evidence / trace / receipt。" },
    ],
  };
}
