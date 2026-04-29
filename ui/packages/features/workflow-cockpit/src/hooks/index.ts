import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkflowsQuery, useRestClient } from "@aa/shared-state";
import type { WorkflowDTO } from "@aa/shared-types";
import { pauseWorkflow, resumeWorkflow, recoverWorkflow, releaseWorkflow } from "@aa/shared-api-client";

export interface WorkflowCockpitVm {
  readonly workflows: readonly WorkflowDTO[];
  readonly listItems: readonly { id: string; title: string; subtitle: string }[];
  readonly selectedId: string | null;
  readonly selectedWorkflow: WorkflowDTO | null;
  readonly activityItems: readonly { title: string; description: string }[];
  readonly pendingAction: boolean;
  selectWorkflow(id: string): void;
  pauseWorkflow(): Promise<void>;
  resumeWorkflow(): Promise<void>;
  recoverWorkflow(): Promise<void>;
  releaseWorkflow(): Promise<void>;
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
  const client = useRestClient();
  const queryWorkflows = useWorkflowsQuery().data ?? [];
  const [workflows, setWorkflows] = useState<readonly WorkflowDTO[]>(queryWorkflows);
  const [selectedId, setSelectedId] = useState<string | null>(queryWorkflows[0]?.id ?? null);
  const [activityItems, setActivityItems] = useState<readonly { title: string; description: string }[]>([]);
  const [pendingAction, setPendingAction] = useState(false);

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

  const doPauseWorkflow = useCallback(async (): Promise<void> => {
    if (selectedWorkflow == null) return;
    setPendingAction(true);
    try {
      await pauseWorkflow(client, selectedWorkflow.id);
      updateSelected(
        (workflow) => ({ ...workflow, status: "paused", currentStage: "waiting_hitl" }),
        `Paused · ${selectedWorkflow.title}`,
        "Workflow entered HITL waiting state.",
      );
    } finally {
      setPendingAction(false);
    }
  }, [client, selectedWorkflow]);

  const doResumeWorkflow = useCallback(async (): Promise<void> => {
    if (selectedWorkflow == null) return;
    setPendingAction(true);
    try {
      await resumeWorkflow(client, selectedWorkflow.id);
      updateSelected(
        (workflow) => ({ ...workflow, status: "running", currentStage: "execute" }),
        `Resumed · ${selectedWorkflow.title}`,
        "Workflow resumed execution from the selected checkpoint.",
      );
    } finally {
      setPendingAction(false);
    }
  }, [client, selectedWorkflow]);

  const doRecoverWorkflow = useCallback(async (): Promise<void> => {
    if (selectedWorkflow == null) return;
    setPendingAction(true);
    try {
      await recoverWorkflow(client, selectedWorkflow.id);
      updateSelected(
        (workflow) => ({ ...workflow, status: "running", currentStage: "recovering" }),
        `Recovered · ${selectedWorkflow.title}`,
        "Recovery controller rebuilt state and replayed the workflow.",
      );
    } finally {
      setPendingAction(false);
    }
  }, [client, selectedWorkflow]);

  const doReleaseWorkflow = useCallback(async (): Promise<void> => {
    if (selectedWorkflow == null) return;
    setPendingAction(true);
    try {
      await releaseWorkflow(client, selectedWorkflow.id);
      updateSelected(
        (workflow) => ({ ...workflow, status: "completed", currentStage: "release" }),
        `Released · ${selectedWorkflow.title}`,
        "Workflow completed release checks and closed successfully.",
      );
    } finally {
      setPendingAction(false);
    }
  }, [client, selectedWorkflow]);

  return {
    ...baseVm,
    selectedId,
    selectedWorkflow,
    activityItems,
    pendingAction,
    selectWorkflow(id: string) {
      setSelectedId(id);
    },
    pauseWorkflow: doPauseWorkflow,
    resumeWorkflow: doResumeWorkflow,
    recoverWorkflow: doRecoverWorkflow,
    releaseWorkflow: doReleaseWorkflow,
  };
}
