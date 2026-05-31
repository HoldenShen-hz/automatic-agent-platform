import { translateMessage } from "@aa/shared-i18n";

export interface DispatchVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useDispatchVm(): DispatchVm {
  return {
    items: [
      {
        title: translateMessage("ui.dispatch.item.queue.title"),
        description: translateMessage("ui.dispatch.item.queue.description"),
      },
      {
        title: translateMessage("ui.dispatch.item.operatorActions.title"),
        description: translateMessage("ui.dispatch.item.operatorActions.description"),
      },
      {
        title: translateMessage("ui.dispatch.item.escalation.title"),
        description: translateMessage("ui.dispatch.item.escalation.description"),
      },
    ],
  };
}
