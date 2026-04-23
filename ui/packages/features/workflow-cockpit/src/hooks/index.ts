import { useWorkflowsQuery } from "@aa/shared-state";
import type { WorkflowDTO } from "@aa/shared-types";

export interface WorkflowCockpitVm {
  readonly workflows: readonly WorkflowDTO[];
  readonly listItems: readonly { id: string; title: string; subtitle: string }[];
}

export function mapWorkflowsToVm(workflows: readonly WorkflowDTO[]): WorkflowCockpitVm {
  return {
    workflows,
    listItems: workflows.map((workflow) => ({
      id: workflow.id,
      title: workflow.title,
      subtitle: `${workflow.status} · ${workflow.currentStage}`,
    })),
  };
}

export function useWorkflowCockpitVm(): WorkflowCockpitVm {
  return mapWorkflowsToVm(useWorkflowsQuery().data ?? []);
}
