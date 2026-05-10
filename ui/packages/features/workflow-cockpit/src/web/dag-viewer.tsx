import type { ReactElement } from "react";
import type { WorkflowStepDTO } from "@aa/shared-types";
import { DAGVisualization, designTokens } from "@aa/ui-core";

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
    case "running": return "#2563eb";
    case "failed": return designTokens.color.danger;
    case "pending": return designTokens.color.subtle;
    default: return designTokens.color.subtle;
  }
}

export function DAGViewer({ steps, currentStage }: DAGViewerProps): ReactElement {
  if (steps.length === 0) {
    return (
      <div style={{ color: designTokens.color.subtle, padding: 16, textAlign: "center" }}>
        No steps available
      </div>
    );
  }

  const currentIdx = getStageIndex(currentStage ?? "");
  const branchGroups = Object.entries(
    steps.reduce<Record<string, WorkflowStepDTO[]>>((groups, step) => {
      if (step.branchId == null || step.branchId.length === 0) {
        return groups;
      }
      groups[step.branchId] ??= [];
      groups[step.branchId]?.push(step);
      return groups;
    }, {}),
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <DAGVisualization
        stages={STAGE_ORDER.map((stage) => {
          const stageSteps = steps.filter((step) => step.phase?.toLowerCase().includes(stage));
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
        OAPEFLIR Stage Rail
      </div>
      <div style={{ display: "flex", gap: 0, alignItems: "center", overflowX: "auto", padding: "8px 0" }}>
        {STAGE_ORDER.map((stage, stageIdx) => {
          const isReached = stageIdx <= currentIdx;
          const isCurrent = stageIdx === currentIdx;
          const stageSteps = steps.filter((s) => s.phase?.toLowerCase().includes(stage));
          const hasSteps = stageSteps.length > 0;

          return (
            <div key={stage} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
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
                  color: isReached ? "#04130a" : designTokens.color.subtle,
                  textTransform: "uppercase",
                }}
              >
                {stage[0]}
              </div>
              {stageIdx < STAGE_ORDER.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    width: "100%",
                    height: 2,
                    background: isReached && stageIdx < currentIdx ? designTokens.color.accent : designTokens.color.border,
                    marginTop: 15,
                    zIndex: -1,
                  }}
                />
              )}
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
                        color: "#04130a",
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
          );
        })}
      </div>
      {/* Step list fallback */}
      {branchGroups.length > 0 && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${designTokens.color.border}`, paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: designTokens.color.subtle, marginBottom: 8 }}>Parallel Branches</div>
          {branchGroups.map(([branchId, branchSteps]) => (
            <div key={branchId} style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 12 }}>{branchId}</strong>
              <div style={{ fontSize: 11, color: designTokens.color.subtle }}>
                {branchSteps.map((step) => `${step.title}:${step.status}`).join(" · ")}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 16, borderTop: `1px solid ${designTokens.color.border}`, paddingTop: 12 }}>
        <div style={{ fontSize: 11, color: designTokens.color.subtle, marginBottom: 8 }}>Step Details</div>
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
                color: "#04130a",
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
