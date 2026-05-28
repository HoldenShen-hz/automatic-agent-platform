import { useMemo, type ReactElement } from "react";
import type { WorkflowStepDTO } from "@aa/shared-types";
import { DAGVisualization, designTokens } from "@aa/ui-core";
import { translateMessage } from "@aa/shared-i18n";

export interface DAGViewerProps {
  readonly steps: readonly WorkflowStepDTO[];
  readonly currentStage?: string;
}

const STAGE_ORDER = ["plan", "review", "execute", "recover", "release"] as const;

function getStageIndex(stage: string): number {
  const lower = stage.toLowerCase();
  const idx = STAGE_ORDER.findIndex((s) => lower.includes(s));
  return idx >= 0 ? idx : 2; // Default to "execute" if unknown
}

function getStepColor(status: WorkflowStepDTO["status"]): string {
  switch (status) {
    case "completed": return designTokens.color.accent;
    case "running": return designTokens.color.info;
    case "failed": return designTokens.color.danger;
    case "pending": return designTokens.color.subtle;
    default: return designTokens.color.subtle;
  }
}

export function DAGViewer({ steps, currentStage }: DAGViewerProps): ReactElement {
  const currentIdx = getStageIndex(currentStage ?? "");
  const branchGroups = useMemo(
    () => Object.entries(
      steps.reduce<Record<string, WorkflowStepDTO[]>>((groups, step) => {
        if (step.branchId == null || step.branchId.length === 0) {
          return groups;
        }
        groups[step.branchId] ??= [];
        groups[step.branchId]?.push(step);
        return groups;
      }, {}),
    ),
    [steps],
  );
  const stageStepsByStage = useMemo(
    () => STAGE_ORDER.reduce<Record<(typeof STAGE_ORDER)[number], readonly WorkflowStepDTO[]>>((accumulator, stage) => ({
      ...accumulator,
      [stage]: steps.filter((step) => step.phase?.toLowerCase().includes(stage)),
    }), {
      plan: [],
      review: [],
      execute: [],
      recover: [],
      release: [],
    }),
    [steps],
  );
  if (steps.length === 0) {
    return (
      <div style={{ color: designTokens.color.subtle, padding: 16, textAlign: "center" }}>
        {translateMessage("ui.workflowDAG.noSteps")}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <DAGVisualization
        stages={STAGE_ORDER.map((stage) => {
          const stageSteps = stageStepsByStage[stage];
          const failedStep = stageSteps.find((step) => step.status === "failed");
          const runningStep = stageSteps.find((step) => step.status === "running");
          return {
            id: stage,
            label: stage,
            status: failedStep != null ? "failed" : runningStep != null ? "running" : stageSteps.length > 0 ? "completed" : "pending",
            items: stageSteps.map((step) => step.title),
          };
        })}
      />
      <div style={{ fontSize: 12, color: designTokens.color.subtle, marginBottom: 4 }}>
        {translateMessage("ui.workflowDAG.stageRail")}
      </div>
      <div style={{ display: "flex", gap: 0, alignItems: "stretch", overflowX: "auto", padding: "8px 0" }}>
        {STAGE_ORDER.map((stage, stageIdx) => {
          const isReached = stageIdx <= currentIdx;
          const stageSteps = stageStepsByStage[stage];
          const hasSteps = stageSteps.length > 0;

          return (
            <div key={stage} style={{ display: "flex", alignItems: "flex-start", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, position: "relative" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: isReached ? designTokens.color.accent : "transparent",
                    border: `2px solid ${isReached ? designTokens.color.accent : designTokens.color.subtle}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: isReached ? designTokens.primitive.color.ink950 : designTokens.color.subtle,
                    textTransform: "uppercase",
                  }}
                >
                  {stage[0]}
                </div>
                <div style={{ fontSize: 10, color: designTokens.color.subtle, marginTop: 4, textAlign: "center" }}>
                  {stage}
                </div>
                {hasSteps && (
                  <div style={{ display: "grid", gap: 4, marginTop: 8, width: "100%" }}>
                    {stageSteps.slice(0, 3).map((step) => (
                      <div
                        key={step.id}
                        style={{
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: getStepColor(step.status),
                          color: designTokens.primitive.color.ink950,
                          fontSize: 9,
                          textAlign: "center",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {step.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {stageIdx < STAGE_ORDER.length - 1 && (
                <div
                  aria-hidden="true"
                  style={{
                    alignSelf: "flex-start",
                    height: 2,
                    flex: 1,
                    marginTop: 15,
                    background: isReached && stageIdx < currentIdx ? designTokens.color.accent : designTokens.color.border,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Step list fallback */}
      {branchGroups.length > 0 && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${designTokens.color.border}`, paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: designTokens.color.subtle, marginBottom: 8 }}>{translateMessage("ui.workflowDAG.parallelBranches")}</div>
          {branchGroups.map(([branchId, branchSteps], branchIndex) => (
            <div key={`${branchId}-${branchIndex}`} style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 12 }}>{branchId}</strong>
              <div style={{ fontSize: 11, color: designTokens.color.subtle }}>
                {branchSteps.map((step) => `${step.title}:${step.status}`).join(" · ")}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 16, borderTop: `1px solid ${designTokens.color.border}`, paddingTop: 12 }}>
        <div style={{ fontSize: 11, color: designTokens.color.subtle, marginBottom: 8 }}>{translateMessage("ui.workflowDAG.stepDetails")}</div>
        {steps.map((step, idx) => (
          <div key={step.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 8, alignItems: "center", padding: "4px 0" }}>
            <span style={{ color: designTokens.color.subtle, fontSize: 10 }}>#{idx + 1}</span>
            <span style={{ fontSize: 12, color: designTokens.color.text }}>
              {step.title}
              {step.dependsOnStepIds != null && step.dependsOnStepIds.length > 0 ? ` ← ${step.dependsOnStepIds.join(", ")}` : ""}
            </span>
            <span
              style={{
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 4,
                background: getStepColor(step.status),
                color: designTokens.primitive.color.ink950,
              }}
            >
              {step.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
