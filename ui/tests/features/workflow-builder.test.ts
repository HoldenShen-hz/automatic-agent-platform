import { afterEach, describe, expect, it } from "vitest";
import { buildWorkflowBuilderSeed } from "../../packages/features/workflow-builder/src/hooks/index.ts";
import { getSharedTranslationService, resetSharedTranslationService } from "../../packages/shared/i18n/src/index.ts";
import type { WorkflowDTO } from "../../packages/shared/types/src";

function buildWorkflow(overrides: Partial<WorkflowDTO> = {}): WorkflowDTO {
  return {
    id: "wf-1",
    title: "Incident Recovery",
    status: "running",
    currentStage: "Execute",
    owner: "ops@example.com",
    steps: [
      {
        id: "observe",
        title: "Collect alerts",
        phase: "Observe",
        status: "completed",
      },
      {
        id: "plan",
        title: "Draft containment",
        phase: "Plan",
        status: "running",
        dependsOnStepIds: ["observe"],
        evidenceRefs: ["ev-1"],
      },
    ],
    approvalNodes: [{ nodeId: "approval-1", title: "Change approval", status: "pending" }],
    evidenceRefs: [{ refId: "artifact-1", type: "artifact", uri: "artifact://incident-1" }],
    ...overrides,
  };
}

describe("workflow builder seed", () => {
  afterEach(() => {
    resetSharedTranslationService();
  });

  it("creates a fallback guided draft when no workflows are available", () => {
    getSharedTranslationService().setLocale("en-US");
    const builder = buildWorkflowBuilderSeed([]);

    expect(builder.canvas.nodes.length).toBeGreaterThan(0);
    expect(builder.canvas.edges.length).toBeGreaterThan(0);
    expect(builder.progressiveDisclosure.level).toBe("guided");
  });

  it("maps workflow steps into builder nodes and dependency edges", () => {
    getSharedTranslationService().setLocale("en-US");
    const builder = buildWorkflowBuilderSeed([buildWorkflow()]);

    expect(builder.canvas.nodes.map((node) => node.nodeId)).toEqual(["observe", "plan"]);
    expect(builder.canvas.nodes[0]?.label).toBe("Observe · Collect alerts");
    expect(builder.canvas.edges).toEqual([{ fromNodeId: "observe", toNodeId: "plan" }]);
    expect(builder.componentPalette[0]?.components[0]?.name).toContain("Observe");
    expect(builder.componentPalette[0]?.components[0]?.configSchema).toEqual({});
  });
});
