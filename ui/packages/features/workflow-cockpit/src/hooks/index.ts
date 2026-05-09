import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkflowsQuery } from "@aa/shared-state";
import { useMutation } from "@aa/shared-state/mutations";
import type { WorkflowDTO } from "@aa/shared-types";
import { createRESTClient, pauseWorkflow as pauseWorkflowApi, resumeWorkflow as resumeWorkflowApi, deleteWorkflow as deleteWorkflowApi } from "@aa/shared-api-client";

const restClient = createRESTClient();

export interface WorkflowCockpitVm {
  readonly workflows: readonly WorkflowDTO[];
  readonly listItems: readonly { id: string; title: string; subtitle: string }[];
  readonly selectedId: string | null;
  readonly selectedWorkflow: WorkflowDTO | null;
  readonly activityItems: readonly { title: string; description: string }[];
  readonly pendingOperations: number;
  selectWorkflow(id: string): void;
  pauseWorkflow(): Promise<void>;
  resumeWorkflow(): Promise<void>;
  recoverWorkflow(): Promise<void>;
  releaseWorkflow(): Promise<void>;
  deleteWorkflow(): Promise<void>;
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
  const [pendingOperations, setPendingOperations] = useState(0);

  const { mutate: pauseMutate, status: pauseStatus } = useMutation({
    client: restClient,
    method: "POST",
    path: (variables: { workflowId: string }) => `/workflows/${variables.workflowId}/pause`,
  });

  const { mutate: resumeMutate, status: resumeStatus } = useMutation({
    client: restClient,
    method: "POST",
    path: (variables: { workflowId: string }) => `/workflows/${variables.workflowId}/resume`,
  });

  const { mutate: deleteMutate, status: deleteStatus } = useMutation({
    client: restClient,
    method: "DELETE",
    path: (variables: { workflowId: string }) => `/workflows/${variables.workflowId}`,
  });

  useEffect(() => {
    setWorkflows(queryWorkflows);
    setSelectedId((current) => current ?? queryWorkflows[0]?.id ?? null);
  }, [queryWorkflows]);

  useEffect(() => {
    const pending = [pauseStatus, resumeStatus, deleteStatus].filter((s) => s === "pending").length;
    setPendingOperations(pending);
  }, [pauseStatus, resumeStatus, deleteStatus]);

  const baseVm = useMemo(() => mapWorkflowsToVm(workflows), [workflows]);
  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedId) ?? workflows[0] ?? null;

  function updateSelected(transform: (workflow: WorkflowDTO) => WorkflowDTO, title: string, description: string): void {
    if (selectedWorkflow == null) {
      return;
    }
    setWorkflows((current) => current.map((workflow) => workflow.id === selectedWorkflow.id ? transform(workflow) : workflow));
    setActivityItems((current) => [{ title, description }, ...current]);
  }

  const pauseWorkflow = useCallback(async () => {
    if (selectedWorkflow == null) return;
    updateSelected(
      (workflow) => ({ ...workflow, status: "paused", currentStage: "waiting_hitl" }),
      `Paused · ${selectedWorkflow.title}`,
      "Workflow entered HITL waiting state.",
    );
    return new Promise<void>((resolve, reject) => {
      pauseMutate(
        { workflowId: selectedWorkflow.id },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        },
      );
    });
  }, [selectedWorkflow, pauseMutate]);

  const resumeWorkflow = useCallback(async () => {
    if (selectedWorkflow == null) return;
    updateSelected(
      (workflow) => ({ ...workflow, status: "running", currentStage: "execute" }),
      `Resumed · ${selectedWorkflow.title}`,
      "Workflow resumed execution from the selected checkpoint.",
    );
    return new Promise<void>((resolve, reject) => {
      resumeMutate(
        { workflowId: selectedWorkflow.id },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        },
      );
    });
  }, [selectedWorkflow, resumeMutate]);

  const recoverWorkflow = useCallback(async () => {
    if (selectedWorkflow == null) return;
    updateSelected(
      (workflow) => ({ ...workflow, status: "running", currentStage: "recovering" }),
      `Recovered · ${selectedWorkflow.title}`,
      "Recovery controller rebuilt state and replayed the workflow.",
    );
    return new Promise<void>((resolve, reject) => {
      resumeMutate(
        { workflowId: selectedWorkflow.id },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        },
      );
    });
  }, [selectedWorkflow, resumeMutate]);

  const releaseWorkflow = useCallback(async () => {
    if (selectedWorkflow == null) return;
    updateSelected(
      (workflow) => ({ ...workflow, status: "completed", currentStage: "release" }),
      `Released · ${selectedWorkflow.title}`,
      "Workflow completed release checks and closed successfully.",
    );
  }, [selectedWorkflow]);

  const deleteWorkflow = useCallback(async () => {
    if (selectedWorkflow == null) return;
    const title = selectedWorkflow.title;
    setWorkflows((current) => current.filter((workflow) => workflow.id !== selectedWorkflow.id));
    setActivityItems((current) => [{ title: `Deleted · ${title}`, description: "Workflow was deleted." }, ...current]);
    return new Promise<void>((resolve, reject) => {
      deleteMutate(
        { workflowId: selectedWorkflow.id },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        },
      );
    });
  }, [selectedWorkflow, deleteMutate]);

  return {
    ...baseVm,
    selectedId,
    selectedWorkflow,
    activityItems,
    pendingOperations,
    selectWorkflow(id: string) {
      setSelectedId(id);
    },
    pauseWorkflow,
    resumeWorkflow,
    recoverWorkflow,
    releaseWorkflow,
    deleteWorkflow,
  };
}
