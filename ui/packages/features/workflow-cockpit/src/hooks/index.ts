import { useEffect, useMemo, useState } from "react";
import { useWorkflowsQuery } from "@aa/shared-state";
import type { WorkflowDTO } from "@aa/shared-types";

export interface WorkflowCockpitVm {
  readonly workflows: readonly WorkflowDTO[];
  readonly listItems: readonly { id: string; title: string; subtitle: string }[];
  readonly selectedId: string | null;
  readonly selectedWorkflow: WorkflowDTO | null;
  readonly activityItems: readonly { title: string; description: string }[];
  selectWorkflow(id: string): void;
  pauseWorkflow(): void;
  resumeWorkflow(): void;
  recoverWorkflow(): void;
  releaseWorkflow(): void;
}

export function mapWorkflowsToVm(workflows: readonly WorkflowDTO[]): Pick<WorkflowCockpitVm, "workflows" | "listItems"> {
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
  const queryWorkflows = useWorkflowsQuery().data ?? [];
  const [workflows, setWorkflows] = useState<readonly WorkflowDTO[]>(queryWorkflows);
  const [selectedId, setSelectedId] = useState<string | null>(queryWorkflows[0]?.id ?? null);
  const [activityItems, setActivityItems] = useState<readonly { title: string; description: string }[]>([]);

  useEffect(() => {
    setWorkflows(queryWorkflows);
    setSelectedId((current) => current ?? queryWorkflows[0]?.id ?? null);
  }, [queryWorkflows]);

  const baseVm = useMemo(() => mapWorkflowsToVm(workflows), [workflows]);
  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedId) ?? workflows[0] ?? null;

  function updateSelected(transform: (workflow: WorkflowDTO) => WorkflowDTO, title: string, description: string): void {
    if (selectedWorkflow == null) {
      return;
    }
    setWorkflows((current) => current.map((workflow) => workflow.id === selectedWorkflow.id ? transform(workflow) : workflow));
    setActivityItems((current) => [{ title, description }, ...current]);
  }

  return {
    ...baseVm,
    selectedId,
    selectedWorkflow,
    activityItems,
    selectWorkflow(id: string) {
      setSelectedId(id);
    },
    pauseWorkflow() {
      updateSelected(
        (workflow) => ({ ...workflow, status: "paused", currentStage: "waiting_hitl" }),
        `Paused · ${selectedWorkflow?.title ?? "workflow"}`,
        "Workflow entered HITL waiting state.",
      );
    },
    resumeWorkflow() {
      updateSelected(
        (workflow) => ({ ...workflow, status: "running", currentStage: "execute" }),
        `Resumed · ${selectedWorkflow?.title ?? "workflow"}`,
        "Workflow resumed execution from the selected checkpoint.",
      );
    },
    recoverWorkflow() {
      updateSelected(
        (workflow) => ({ ...workflow, status: "running", currentStage: "recovering" }),
        `Recovered · ${selectedWorkflow?.title ?? "workflow"}`,
        "Recovery controller rebuilt state and replayed the workflow.",
      );
    },
    releaseWorkflow() {
      updateSelected(
        (workflow) => ({ ...workflow, status: "completed", currentStage: "release" }),
        `Released · ${selectedWorkflow?.title ?? "workflow"}`,
        "Workflow completed release checks and closed successfully.",
      );
    },
  };
}
