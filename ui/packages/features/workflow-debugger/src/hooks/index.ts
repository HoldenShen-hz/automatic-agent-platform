import { translateMessage } from "@aa/shared-i18n";

export interface WorkflowDebuggerVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useWorkflowDebuggerVm(): WorkflowDebuggerVm {
  return {
    items: [
      {
        title: translateMessage("ui.workflowDebugger.item.timeline.title"),
        description: translateMessage("ui.workflowDebugger.item.timeline.description"),
      },
      {
        title: translateMessage("ui.workflowDebugger.item.stepIn.title"),
        description: translateMessage("ui.workflowDebugger.item.stepIn.description"),
      },
      {
        title: translateMessage("ui.workflowDebugger.item.timeTravel.title"),
        description: translateMessage("ui.workflowDebugger.item.timeTravel.description"),
      },
    ],
  };
}
