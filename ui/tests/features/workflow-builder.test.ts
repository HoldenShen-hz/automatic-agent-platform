import { afterEach, describe, expect, it } from "vitest";
import { mapWorkflowsToBuilderVm } from "../../packages/features/workflow-builder/src/hooks/index.ts";
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

describe("workflow builder vm", () => {
  afterEach(() => {
    resetSharedTranslationService();
  });

  it("does not fabricate a demo graph when no workflows are available", () => {
    getSharedTranslationService().setLocale("en-US");
    const vm = mapWorkflowsToBuilderVm([]);

    expect(vm.nodes).toEqual([]);
    expect(vm.edges).toEqual([]);
    expect(vm.items[0]?.title).toBe("No workflow data");
  });

  it("maps real workflow steps into nodes, edges, and governance summaries", () => {
    getSharedTranslationService().setLocale("en-US");
    const vm = mapWorkflowsToBuilderVm([buildWorkflow()]);

    expect(vm.nodes.map((node) => node.id)).toEqual(["observe", "plan"]);
    expect(vm.nodes[0]?.data.label).toBe("Observe · Collect alerts");
    expect(vm.edges).toEqual([{ id: "observe->plan", source: "observe", target: "plan" }]);
    expect(vm.items[0]?.description).toContain("Incident Recovery");
    expect(vm.items[2]?.description).toContain("approval");
  });
});
