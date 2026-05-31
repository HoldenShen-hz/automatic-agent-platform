import { translateMessage } from "@aa/shared-i18n";

export interface PolicyVm {
  readonly items: readonly { title: string; description: string }[];
}

export function usePolicyVm(): PolicyVm {
  return {
    items: [
      {
        title: translateMessage("ui.policy.item.approval.title"),
        description: translateMessage("ui.policy.item.approval.description"),
      },
      {
        title: translateMessage("ui.policy.item.action.title"),
        description: translateMessage("ui.policy.item.action.description"),
      },
      {
        title: translateMessage("ui.policy.item.visibility.title"),
        description: translateMessage("ui.policy.item.visibility.description"),
      },
    ],
  };
}
