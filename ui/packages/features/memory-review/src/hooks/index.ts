import { translateMessage } from "@aa/shared-i18n";

export interface MemoryReviewVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useMemoryReviewVm(): MemoryReviewVm {
  return {
    items: [
      {
        title: translateMessage("ui.memoryReview.item.pending.title"),
        description: translateMessage("ui.memoryReview.item.pending.description"),
      },
      {
        title: translateMessage("ui.memoryReview.item.revoke.title"),
        description: translateMessage("ui.memoryReview.item.revoke.description"),
      },
      {
        title: translateMessage("ui.memoryReview.item.lineage.title"),
        description: translateMessage("ui.memoryReview.item.lineage.description"),
      },
    ],
  };
}
