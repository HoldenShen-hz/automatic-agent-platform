import { translateMessage } from "@aa/shared-i18n";

export interface InspectVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useInspectVm(): InspectVm {
  return {
    items: [
      {
        title: translateMessage("ui.inspect.item.snapshot.title"),
        description: translateMessage("ui.inspect.item.snapshot.description"),
      },
      {
        title: translateMessage("ui.inspect.item.toolTrace.title"),
        description: translateMessage("ui.inspect.item.toolTrace.description"),
      },
      {
        title: translateMessage("ui.inspect.item.evidence.title"),
        description: translateMessage("ui.inspect.item.evidence.description"),
      },
    ],
  };
}
