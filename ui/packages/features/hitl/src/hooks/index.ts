import { useCallback, useEffect, useState } from "react";
import { useMutation } from "@aa/shared-state/mutations";
import type { TaskDTO, WorkflowRunStepDTO } from "@aa/shared-types";
import { createRESTClient } from "@aa/shared-api-client";

const restClient = createRESTClient();

export interface HitlAction {
  readonly id: string;
  readonly type: "inspect" | "takeover" | "resume" | "abort";
  readonly title: string;
  readonly description: string;
  readonly timestamp: string;
  readonly operator?: string;
}

export interface HitlContext {
  readonly planBundle?: unknown;
  readonly executionState?: string;
  readonly currentStep?: WorkflowRunStepDTO;
  readonly taskContext?: TaskDTO;
}

export interface HitlVm {
  readonly items: readonly { title: string; description: string }[];
  readonly selectedAction: HitlAction | null;
  readonly context: HitlContext;
  readonly pendingOperations: number;
  selectAction(action: HitlAction): void;
  executeAction(actionType: "takeover" | "resume" | "abort", taskId: string): Promise<void>;
  inspectContext(taskId: string): Promise<void>;
}

export function useHitlVm(): HitlVm {
  const [items, setItems] = useState<readonly { title: string; description: string }[]>([
    { title: "Inspect", description: "查看当前 PlanBundle、Context 和执行状态。" },
    { title: "Takeover", description: "接管执行并写入人工操作记录。" },
    { title: "Resume", description: "支持 normal、replan、supervised、abort 四种恢复模式。" },
  ]);
  const [selectedAction, setSelectedAction] = useState<HitlAction | null>(null);
  const [context, setContext] = useState<HitlContext>({});
  const [pendingOperations, setPendingOperations] = useState(0);

  const { mutate: updateTaskMutate, status: updateStatus } = useMutation({
    client: restClient,
    method: "PUT",
    path: (variables: { taskId: string; body: Partial<TaskDTO> }) => `/tasks/${variables.taskId}`,
  });

  useEffect(() => {
    setPendingOperations(updateStatus === "pending" ? 1 : 0);
  }, [updateStatus]);

  const inspectContext = useCallback(async (taskId: string) => {
    try {
      const [task, steps] = await Promise.all([
        restClient.get<TaskDTO>(`/tasks/${taskId}`),
        restClient.get<readonly WorkflowRunStepDTO[]>(`/workflow-runs/${taskId}/steps`).catch(() => [] as readonly WorkflowRunStepDTO[]),
      ]);

      setContext({
        taskContext: task,
        currentStep: steps[0],
        executionState: task.status,
      });
    } catch {
      setContext({});
    }
  }, []);

  const executeAction = useCallback(async (actionType: "takeover" | "resume" | "abort", taskId: string) => {
    const action: HitlAction = {
      id: crypto.randomUUID(),
      type: actionType === "takeover" ? "takeover" : actionType === "resume" ? "resume" : "abort",
      title: actionType.charAt(0).toUpperCase() + actionType.slice(1),
      description: `HITL action: ${actionType} executed on task ${taskId}`,
      timestamp: new Date().toISOString(),
      operator: "current-user",
    };

    setSelectedAction(action);
    setItems((current) => [action, ...current].map((a) => ({
      title: a.title,
      description: "timestamp" in a ? `${a.description} (${new Date(a.timestamp).toLocaleTimeString()})` : a.description,
    })) as typeof items);

    const bodyUpdates: Partial<TaskDTO> = {};
    switch (actionType) {
      case "takeover":
        bodyUpdates.owner = "current-user";
        bodyUpdates.status = "running";
        break;
      case "resume":
        bodyUpdates.status = "running";
        bodyUpdates.currentStep = "resume";
        break;
      case "abort":
        bodyUpdates.status = "completed";
        bodyUpdates.currentStep = "aborted";
        break;
    }

    return new Promise<void>((resolve, reject) => {
      updateTaskMutate(
        { taskId, body: bodyUpdates },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        },
      );
    });
  }, [updateTaskMutate]);

  return {
    items,
    selectedAction,
    context,
    pendingOperations,
    selectAction(action: HitlAction) {
      setSelectedAction(action);
    },
    executeAction,
    inspectContext,
  };
}
