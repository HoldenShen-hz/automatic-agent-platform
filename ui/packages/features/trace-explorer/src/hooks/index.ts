import { translateMessage } from "@aa/shared-i18n";

export interface TraceExplorerVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useTraceExplorerVm(): TraceExplorerVm {
  return {
    items: [
      {
        title: translateMessage("ui.traceExplorer.item.timeline.title"),
        description: translateMessage("ui.traceExplorer.item.timeline.description"),
      },
      {
        title: translateMessage("ui.traceExplorer.item.restricted.title"),
        description: translateMessage("ui.traceExplorer.item.restricted.description"),
      },
      {
        title: translateMessage("ui.traceExplorer.item.receipt.title"),
        description: translateMessage("ui.traceExplorer.item.receipt.description"),
      },
    ],
  };
}
