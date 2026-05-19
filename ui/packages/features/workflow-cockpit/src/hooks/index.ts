import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRestClient, useWorkflowsQuery } from "@aa/shared-state";
import type { WorkflowDTO } from "@aa/shared-types";
import {
  cancelWorkflow,
  pauseWorkflow as pauseWorkflowApi,
  recoverWorkflow as recoverWorkflowApi,
  releaseWorkflow as releaseWorkflowApi,
  resumeWorkflow as resumeWorkflowApi,
} from "@aa/shared-api-client";

export interface WorkflowCockpitVm {
  readonly workflows: readonly WorkflowDTO[];
  readonly listItems: readonly { id: string; title: string; subtitle: string }[];
  readonly selectedId: string | null;
  readonly selectedWorkflow: WorkflowDTO | null;
  readonly activityItems: readonly { title: string; description: string }[];
  readonly pendingOperations: number;
  selectWorkflow(id: string): void;
  cancelWorkflow(): Promise<void>;
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
  const queryClient = useQueryClient();
  const workflows = useWorkflowsQuery().data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activityItems, setActivityItems] = useState<readonly { title: string; description: string }[]>([]);
  const [pendingOperations, setPendingOperations] = useState(0);

  useEffect(() => {
    setSelectedId((current) => {
      if (current != null && workflows.some((workflow) => workflow.id === current)) {
        return current;
      }
      return null;
    });
  }, [workflows]);

  const baseVm = useMemo(() => mapWorkflowsToVm(workflows), [workflows]);
  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedId) ?? null;

  const runAction = useCallback(async (
    action: () => Promise<unknown>,
    title: string,
    description: string,
  ) => {
    setPendingOperations((current) => current + 1);
    try {
      await action();
      setActivityItems((current) => [{ title, description }, ...current]);
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
    } finally {
      setPendingOperations((current) => Math.max(0, current - 1));
    }
  }, [queryClient]);

  const cancelSelectedWorkflow = useCallback(async () => {
    if (selectedWorkflow == null) {
      return;
    }
    await runAction(
      () => cancelWorkflow(client, selectedWorkflow.id),
      `Canceled · ${selectedWorkflow.title}`,
      "Workflow was canceled from the cockpit.",
    );
  }, [client, runAction, selectedWorkflow]);

  const pauseSelectedWorkflow = useCallback(async () => {
    if (selectedWorkflow == null) {
      return;
    }
    await runAction(
      () => pauseWorkflowApi(client, selectedWorkflow.id),
      `Paused · ${selectedWorkflow.title}`,
      "Workflow entered HITL waiting state.",
    );
  }, [client, runAction, selectedWorkflow]);

  const resumeSelectedWorkflow = useCallback(async () => {
    if (selectedWorkflow == null) {
      return;
    }
    await runAction(
      () => resumeWorkflowApi(client, selectedWorkflow.id),
      `Resumed · ${selectedWorkflow.title}`,
      "Workflow resumed execution from the selected checkpoint.",
    );
  }, [client, runAction, selectedWorkflow]);

  const recoverSelectedWorkflow = useCallback(async () => {
    if (selectedWorkflow == null) {
      return;
    }
    await runAction(
      () => recoverWorkflowApi(client, selectedWorkflow.id),
      `Recovered · ${selectedWorkflow.title}`,
      "Recovery controller rebuilt state and replayed the workflow.",
    );
  }, [client, runAction, selectedWorkflow]);

  const releaseSelectedWorkflow = useCallback(async () => {
    if (selectedWorkflow == null) {
      return;
    }
    await runAction(
      () => releaseWorkflowApi(client, selectedWorkflow.id),
      `Released · ${selectedWorkflow.title}`,
      "Workflow completed release checks and closed successfully.",
    );
  }, [client, runAction, selectedWorkflow]);

  return {
    ...baseVm,
    selectedId,
    selectedWorkflow,
    activityItems,
    pendingOperations,
    selectWorkflow: setSelectedId,
    cancelWorkflow: cancelSelectedWorkflow,
    pauseWorkflow: pauseSelectedWorkflow,
    resumeWorkflow: resumeSelectedWorkflow,
    recoverWorkflow: recoverSelectedWorkflow,
    releaseWorkflow: releaseSelectedWorkflow,
  };
}
