import { useMemo } from "react";
import { translateMessage } from "@aa/shared-i18n";
import { useWorkflowsQuery } from "@aa/shared-state";
import type { WorkflowDTO, WorkflowStepDTO } from "@aa/shared-types";

export interface WorkflowBuilderVm {
  readonly items: readonly { title: string; description: string }[];
  readonly nodes: readonly {
    readonly id: string;
    readonly position: { readonly x: number; readonly y: number };
    readonly data: { readonly label: string };
    readonly type: "default";
  }[];
  readonly edges: readonly {
    readonly id: string;
    readonly source: string;
    readonly target: string;
  }[];
}

const PHASE_Y_POSITION: Readonly<Record<WorkflowStepDTO["phase"], number>> = {
  Observe: 24,
  Assess: 120,
  Plan: 216,
  Execute: 312,
  Feedback: 408,
  Learn: 504,
  Improve: 600,
  Release: 696,
};

function mapWorkflowStepsToNodes(steps: readonly WorkflowStepDTO[]): WorkflowBuilderVm["nodes"] {
  return steps.map((step, index) => ({
    id: step.id,
    position: {
      x: index * 180,
      y: PHASE_Y_POSITION[step.phase],
    },
    data: {
      label: `${step.phase} · ${step.title}`,
    },
    type: "default",
  }));
}

function mapWorkflowStepsToEdges(steps: readonly WorkflowStepDTO[]): WorkflowBuilderVm["edges"] {
  const stepIds = new Set(steps.map((step) => step.id));
  const dependencyEdges = steps.flatMap((step) =>
    (step.dependsOnStepIds ?? [])
      .filter((dependencyId) => stepIds.has(dependencyId))
      .map((dependencyId) => ({
        id: `${dependencyId}->${step.id}`,
        source: dependencyId,
        target: step.id,
      })));
  if (dependencyEdges.length > 0) {
    return dependencyEdges;
  }
  return steps.slice(1).map((step, index) => ({
    id: `${steps[index]!.id}->${step.id}`,
    source: steps[index]!.id,
    target: step.id,
  }));
}

export function mapWorkflowsToBuilderVm(workflows: readonly WorkflowDTO[]): WorkflowBuilderVm {
  const selectedWorkflow = workflows[0] ?? null;
  if (selectedWorkflow == null) {
    return {
      nodes: [],
      edges: [],
      items: [
        {
          title: translateMessage("ui.workflowBuilder.empty.title"),
          description: translateMessage("ui.workflowBuilder.empty.description"),
        },
      ],
    };
  }

  const evidenceCount = selectedWorkflow.steps.reduce(
    (count, step) => count + (step.evidenceRefs?.length ?? 0),
    selectedWorkflow.evidenceRefs?.length ?? 0,
  );

  return {
    nodes: mapWorkflowStepsToNodes(selectedWorkflow.steps),
    edges: mapWorkflowStepsToEdges(selectedWorkflow.steps),
    items: [
      {
        title: translateMessage("ui.workflowBuilder.summary.workflow.title"),
        description: translateMessage("ui.workflowBuilder.summary.workflow.description", {
          title: selectedWorkflow.title,
          status: selectedWorkflow.status,
          stage: selectedWorkflow.currentStage,
        }),
      },
      {
        title: translateMessage("ui.workflowBuilder.summary.steps.title"),
        description: translateMessage("ui.workflowBuilder.summary.steps.description", {
          count: selectedWorkflow.steps.length,
        }),
      },
      {
        title: translateMessage("ui.workflowBuilder.summary.governance.title"),
        description: translateMessage("ui.workflowBuilder.summary.governance.description", {
          approvals: selectedWorkflow.approvalNodes?.length ?? 0,
          evidence: evidenceCount,
        }),
      },
    ],
  };
}

export function useWorkflowBuilderVm(): WorkflowBuilderVm {
  const workflows = useWorkflowsQuery().data ?? [];
  return useMemo(() => mapWorkflowsToBuilderVm(workflows), [workflows]);
}
