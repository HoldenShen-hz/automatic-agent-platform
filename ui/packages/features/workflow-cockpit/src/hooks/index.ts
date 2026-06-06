import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { translateMessage } from "@aa/shared-i18n";
import { useRestClient, useTasksQuery, useWorkflowsQuery } from "@aa/shared-state";
import type { TaskDTO, WorkflowDTO, WorkflowEvidenceRefDTO, WorkflowStepDTO } from "@aa/shared-types";
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
  readonly controls: {
    readonly cancelEnabled: boolean;
    readonly pauseEnabled: boolean;
    readonly resumeEnabled: boolean;
    readonly recoverEnabled: boolean;
    readonly releaseEnabled: boolean;
  };
  readonly activityItems: readonly { title: string; description: string }[];
  readonly pendingOperations: number;
  selectWorkflow(id: string): void;
  cancelWorkflow(): Promise<void>;
  pauseWorkflow(): Promise<void>;
  resumeWorkflow(): Promise<void>;
  recoverWorkflow(): Promise<void>;
  releaseWorkflow(): Promise<void>;
}

type WorkflowCockpitResponse = {
  readonly summary?: {
    readonly taskId?: string;
    readonly workflowId?: string;
    readonly workflowStatus?: string | null;
    readonly currentStepIndex?: number | null;
    readonly resumableFromStep?: string | null;
    readonly divisionId?: string | null;
    readonly taskStatus?: string | null;
  };
  readonly inspect?: {
    readonly task?: {
      readonly id?: string;
      readonly title?: string;
      readonly divisionId?: string | null;
      readonly status?: string | null;
    };
    readonly workflowState?: {
      readonly workflowId?: string;
      readonly status?: string | null;
      readonly currentStepIndex?: number | null;
      readonly resumableFromStep?: string | null;
    } | null;
    readonly approvals?: ReadonlyArray<{
      readonly approvalId?: string;
      readonly title?: string;
      readonly status?: string;
      readonly approverId?: string | null;
    }>;
    readonly stepOutputs?: ReadonlyArray<{
      readonly id?: string;
      readonly stepId?: string | null;
      readonly roleId?: string | null;
      readonly status?: string | null;
      readonly summary?: string | null;
      readonly producedAt?: string;
    }>;
    readonly artifacts?: ReadonlyArray<{
      readonly artifactId?: string;
      readonly kind?: string | null;
      readonly fileName?: string | null;
      readonly storagePath?: string | null;
    }>;
  };
};

function mapWorkflowStepStatus(status: string | null | undefined): WorkflowStepDTO["status"] {
  switch (status) {
    case "failed":
      return "failed";
    case "succeeded":
    case "partial_success":
    case "skipped":
    case "completed":
      return "completed";
    case "running":
      return "running";
    default:
      return "pending";
  }
}

function mapWorkflowEvidenceType(kind: string | null | undefined): WorkflowEvidenceRefDTO["type"] {
  if (kind == null) {
    return "artifact";
  }
  if (kind.includes("report")) {
    return "report";
  }
  if (kind.includes("trace")) {
    return "trace";
  }
  if (kind.includes("log")) {
    return "log";
  }
  return "artifact";
}

function mapWorkflowDetailStatus(status: string | null | undefined): WorkflowDTO["status"] {
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "paused":
    case "blocked":
    case "awaiting_decision":
      return "paused";
    case "draft":
      return "draft";
    default:
      return "running";
  }
}

function enrichWorkflowSummary(workflow: WorkflowDTO, tasksById: ReadonlyMap<string, TaskDTO>): WorkflowDTO {
  const linkedTask = tasksById.get(workflow.id);
  return {
    ...workflow,
    title: linkedTask?.title ?? workflow.title,
    domainId: linkedTask?.domainId ?? workflow.domainId ?? workflow.owner,
  };
}

function getWorkflowPriority(workflow: WorkflowDTO): number {
  switch (workflow.status) {
    case "failed":
      return 0;
    case "running":
      return 1;
    case "paused":
      return 2;
    case "draft":
      return 3;
    case "completed":
      return 4;
    case "cancelled":
      return 5;
    default:
      return 6;
  }
}

function sortWorkflowsByPriority(workflows: readonly WorkflowDTO[]): readonly WorkflowDTO[] {
  return [...workflows].sort((left, right) => getWorkflowPriority(left) - getWorkflowPriority(right));
}

function mapWorkflowDetail(
  workflowId: string,
  cockpit: WorkflowCockpitResponse,
  fallbackWorkflow: WorkflowDTO | null,
  fallbackTask: TaskDTO | undefined,
): WorkflowDTO {
  const task = cockpit.inspect?.task;
  const workflowState = cockpit.inspect?.workflowState;
  const stepOutputs = cockpit.inspect?.stepOutputs ?? [];
  const artifacts = cockpit.inspect?.artifacts ?? [];
  const approvals = cockpit.inspect?.approvals ?? [];
  const currentStepIndex = workflowState?.currentStepIndex ?? cockpit.summary?.currentStepIndex ?? null;
  const currentStage = workflowState?.resumableFromStep
    ?? fallbackWorkflow?.currentStage
    ?? (typeof currentStepIndex === "number" ? `step-${currentStepIndex}` : "intake");

  return {
    id: task?.id ?? cockpit.summary?.taskId ?? workflowId,
    title: task?.title ?? fallbackTask?.title ?? fallbackWorkflow?.title ?? cockpit.summary?.workflowId ?? workflowId,
    status: mapWorkflowDetailStatus(workflowState?.status ?? cockpit.summary?.workflowStatus ?? task?.status)
      ?? fallbackWorkflow?.status
      ?? "running",
    currentStage,
    owner: fallbackWorkflow?.owner ?? "unknown",
    domainId: task?.divisionId
      ?? fallbackTask?.domainId
      ?? fallbackWorkflow?.domainId
      ?? cockpit.summary?.divisionId
      ?? "platform",
    steps: stepOutputs.map((step, index) => ({
      id: step.id ?? step.stepId ?? `${workflowId}-step-${index + 1}`,
      title: step.summary ?? step.stepId ?? `step-${index + 1}`,
      phase: "Execute",
      status: mapWorkflowStepStatus(step.status),
      ...(step.producedAt == null ? {} : { completedAt: step.producedAt }),
    })),
    approvalNodes: approvals.map((approval, index) => ({
      nodeId: approval.approvalId ?? `${workflowId}-approval-${index + 1}`,
      title: approval.title ?? approval.approvalId ?? `approval-${index + 1}`,
      status: approval.status === "approved" || approval.status === "rejected" || approval.status === "delegated"
        ? approval.status
        : "pending",
      ...(approval.approverId == null ? {} : { assignee: approval.approverId }),
    })),
    evidenceRefs: artifacts
      .filter((artifact): artifact is NonNullable<typeof artifact> & { artifactId: string } => typeof artifact?.artifactId === "string")
      .map((artifact, index) => ({
        refId: artifact.artifactId,
        type: mapWorkflowEvidenceType(artifact.kind),
        uri: artifact.storagePath ?? `artifact://${artifact.artifactId}`,
        description: artifact.fileName ?? artifact.kind ?? `artifact-${index + 1}`,
      })),
  };
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

function buildWorkflowControls(workflow: WorkflowDTO | null): WorkflowCockpitVm["controls"] {
  if (workflow == null) {
    return {
      cancelEnabled: false,
      pauseEnabled: false,
      resumeEnabled: false,
      recoverEnabled: false,
      releaseEnabled: false,
    };
  }

  switch (workflow.status) {
    case "running":
      return {
        cancelEnabled: true,
        pauseEnabled: true,
        resumeEnabled: false,
        recoverEnabled: false,
        releaseEnabled: true,
      };
    case "paused":
      return {
        cancelEnabled: true,
        pauseEnabled: false,
        resumeEnabled: true,
        recoverEnabled: false,
        releaseEnabled: false,
      };
    case "failed":
      return {
        cancelEnabled: false,
        pauseEnabled: false,
        resumeEnabled: false,
        recoverEnabled: true,
        releaseEnabled: false,
      };
    default:
      return {
        cancelEnabled: false,
        pauseEnabled: false,
        resumeEnabled: false,
        recoverEnabled: false,
        releaseEnabled: false,
      };
  }
}

export function useWorkflowCockpitVm(): WorkflowCockpitVm {
  const client = useRestClient();
  const queryClient = useQueryClient();
  const workflows = useWorkflowsQuery().data ?? [];
  const tasks = useTasksQuery().data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activityItems, setActivityItems] = useState<readonly { title: string; description: string }[]>([]);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [serverWorkflow, setServerWorkflow] = useState<WorkflowDTO | null>(null);

  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task] as const)),
    [tasks],
  );
  const resolvedWorkflows = useMemo(
    () => sortWorkflowsByPriority(workflows.map((workflow) => enrichWorkflowSummary(workflow, tasksById))),
    [tasksById, workflows],
  );

  useEffect(() => {
    setSelectedId((current) => {
      if (current != null && resolvedWorkflows.some((workflow) => workflow.id === current)) {
        return current;
      }
      return resolvedWorkflows[0]?.id ?? null;
    });
  }, [resolvedWorkflows]);

  useEffect(() => {
    if (serverWorkflow != null && !resolvedWorkflows.some((workflow) => workflow.id === serverWorkflow.id)) {
      setServerWorkflow(null);
    }
  }, [resolvedWorkflows, serverWorkflow]);

  const baseVm = useMemo(() => mapWorkflowsToVm(resolvedWorkflows), [resolvedWorkflows]);
  const selectedSummaryWorkflow = resolvedWorkflows.find((workflow) => workflow.id === selectedId) ?? null;
  const selectedWorkflow = serverWorkflow?.id === selectedId
    ? serverWorkflow
    : selectedSummaryWorkflow;
  const controls = useMemo(() => buildWorkflowControls(selectedWorkflow), [selectedWorkflow]);

  const fetchWorkflowDetail = useCallback(async (workflowId: string) => {
    const cockpit = await client.get<WorkflowCockpitResponse>(`/v1/workflows/${encodeURIComponent(workflowId)}`);
    const fallbackWorkflow = resolvedWorkflows.find((workflow) => workflow.id === workflowId) ?? null;
    const nextWorkflow = mapWorkflowDetail(workflowId, cockpit, fallbackWorkflow, tasksById.get(workflowId));
    setServerWorkflow(nextWorkflow);
  }, [client, resolvedWorkflows, tasksById]);

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

  const selectWorkflow = useCallback((workflowId: string) => {
    setSelectedId(workflowId);
    void fetchWorkflowDetail(workflowId).catch(() => {
      setServerWorkflow(null);
    });
  }, [fetchWorkflowDetail]);

  useEffect(() => {
    if (selectedId == null) {
      return;
    }
    void fetchWorkflowDetail(selectedId).catch(() => {
      setServerWorkflow(null);
    });
  }, [fetchWorkflowDetail, selectedId, selectedSummaryWorkflow?.currentStage, selectedSummaryWorkflow?.status]);

  const cancelSelectedWorkflow = useCallback(async () => {
    if (selectedWorkflow == null || !controls.cancelEnabled) {
      return;
    }
    await runAction(
      () => cancelWorkflow(client, selectedWorkflow.id),
      translateMessage("ui.workflowCockpit.activity.cancel.title", { title: selectedWorkflow.title }),
      translateMessage("ui.workflowCockpit.activity.cancel.description"),
    );
  }, [client, controls.cancelEnabled, runAction, selectedWorkflow]);

  const pauseSelectedWorkflow = useCallback(async () => {
    if (selectedWorkflow == null || !controls.pauseEnabled) {
      return;
    }
    await runAction(
      () => pauseWorkflowApi(client, selectedWorkflow.id),
      translateMessage("ui.workflowCockpit.activity.pause.title", { title: selectedWorkflow.title }),
      translateMessage("ui.workflowCockpit.activity.pause.description"),
    );
  }, [client, controls.pauseEnabled, runAction, selectedWorkflow]);

  const resumeSelectedWorkflow = useCallback(async () => {
    if (selectedWorkflow == null || !controls.resumeEnabled) {
      return;
    }
    await runAction(
      () => resumeWorkflowApi(client, selectedWorkflow.id),
      translateMessage("ui.workflowCockpit.activity.resume.title", { title: selectedWorkflow.title }),
      translateMessage("ui.workflowCockpit.activity.resume.description"),
    );
  }, [client, controls.resumeEnabled, runAction, selectedWorkflow]);

  const recoverSelectedWorkflow = useCallback(async () => {
    if (selectedWorkflow == null || !controls.recoverEnabled) {
      return;
    }
    await runAction(
      () => recoverWorkflowApi(client, selectedWorkflow.id),
      translateMessage("ui.workflowCockpit.activity.recover.title", { title: selectedWorkflow.title }),
      translateMessage("ui.workflowCockpit.activity.recover.description"),
    );
  }, [client, controls.recoverEnabled, runAction, selectedWorkflow]);

  const releaseSelectedWorkflow = useCallback(async () => {
    if (selectedWorkflow == null || !controls.releaseEnabled) {
      return;
    }
    await runAction(
      () => releaseWorkflowApi(client, selectedWorkflow.id),
      translateMessage("ui.workflowCockpit.activity.release.title", { title: selectedWorkflow.title }),
      translateMessage("ui.workflowCockpit.activity.release.description"),
    );
  }, [client, controls.releaseEnabled, runAction, selectedWorkflow]);

  return {
    ...baseVm,
    selectedId,
    selectedWorkflow,
    controls,
    activityItems,
    pendingOperations,
    selectWorkflow,
    cancelWorkflow: cancelSelectedWorkflow,
    pauseWorkflow: pauseSelectedWorkflow,
    resumeWorkflow: resumeSelectedWorkflow,
    recoverWorkflow: recoverSelectedWorkflow,
    releaseWorkflow: releaseSelectedWorkflow,
  };
}
