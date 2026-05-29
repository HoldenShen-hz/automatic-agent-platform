import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { DAGVisualization, designTokens } from "@aa/ui-core";
import { translateMessage } from "@aa/shared-i18n";
const STAGE_ORDER = ["plan", "review", "execute", "recover", "release"];
function getStageIndex(stage) {
    const lower = stage.toLowerCase();
    const idx = STAGE_ORDER.findIndex((s) => lower.includes(s));
    return idx >= 0 ? idx : 2; // Default to "execute" if unknown
}
function getStepColor(status) {
    switch (status) {
        case "completed": return designTokens.color.accent;
        case "running": return designTokens.color.info;
        case "failed": return designTokens.color.danger;
        case "pending": return designTokens.color.subtle;
        default: return designTokens.color.subtle;
    }
}
export function DAGViewer({ steps, currentStage }) {
    const currentIdx = getStageIndex(currentStage ?? "");
    const branchGroups = useMemo(() => Object.entries(steps.reduce((groups, step) => {
        if (step.branchId == null || step.branchId.length === 0) {
            return groups;
        }
        groups[step.branchId] ??= [];
        groups[step.branchId]?.push(step);
        return groups;
    }, {})), [steps]);
    const stageStepsByStage = useMemo(() => STAGE_ORDER.reduce((accumulator, stage) => ({
        ...accumulator,
        [stage]: steps.filter((step) => step.phase?.toLowerCase().includes(stage)),
    }), {
        plan: [],
        review: [],
        execute: [],
        recover: [],
        release: [],
    }), [steps]);
    if (steps.length === 0) {
        return (_jsx("div", { style: { color: designTokens.color.subtle, padding: 16, textAlign: "center" }, children: translateMessage("ui.workflowDAG.noSteps") }));
    }
    return (_jsxs("div", { style: { display: "grid", gap: 12 }, children: [_jsx(DAGVisualization, { stages: STAGE_ORDER.map((stage) => {
                    const stageSteps = stageStepsByStage[stage];
                    const failedStep = stageSteps.find((step) => step.status === "failed");
                    const runningStep = stageSteps.find((step) => step.status === "running");
                    return {
                        id: stage,
                        label: stage,
                        status: failedStep != null ? "failed" : runningStep != null ? "running" : stageSteps.length > 0 ? "completed" : "pending",
                        items: stageSteps.map((step) => step.title),
                    };
                }) }), _jsx("div", { style: { fontSize: 12, color: designTokens.color.subtle, marginBottom: 4 }, children: translateMessage("ui.workflowDAG.stageRail") }), _jsx("div", { style: { display: "flex", gap: 0, alignItems: "stretch", overflowX: "auto", padding: "8px 0" }, children: STAGE_ORDER.map((stage, stageIdx) => {
                    const isReached = stageIdx <= currentIdx;
                    const stageSteps = stageStepsByStage[stage];
                    const hasSteps = stageSteps.length > 0;
                    return (_jsxs("div", { style: { display: "flex", alignItems: "flex-start", flex: 1 }, children: [_jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1, position: "relative" }, children: [_jsx("div", { style: {
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
                                        }, children: stage[0] }), _jsx("div", { style: { fontSize: 10, color: designTokens.color.subtle, marginTop: 4, textAlign: "center" }, children: stage }), hasSteps && (_jsx("div", { style: { display: "grid", gap: 4, marginTop: 8, width: "100%" }, children: stageSteps.slice(0, 3).map((step) => (_jsx("div", { style: {
                                                padding: "2px 6px",
                                                borderRadius: 4,
                                                background: getStepColor(step.status),
                                                color: designTokens.primitive.color.ink950,
                                                fontSize: 9,
                                                textAlign: "center",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }, children: step.title }, step.id))) }))] }), stageIdx < STAGE_ORDER.length - 1 && (_jsx("div", { "aria-hidden": "true", style: {
                                    alignSelf: "flex-start",
                                    height: 2,
                                    flex: 1,
                                    marginTop: 15,
                                    background: isReached && stageIdx < currentIdx ? designTokens.color.accent : designTokens.color.border,
                                } }))] }, stage));
                }) }), branchGroups.length > 0 && (_jsxs("div", { style: { marginTop: 16, borderTop: `1px solid ${designTokens.color.border}`, paddingTop: 12 }, children: [_jsx("div", { style: { fontSize: 11, color: designTokens.color.subtle, marginBottom: 8 }, children: translateMessage("ui.workflowDAG.parallelBranches") }), branchGroups.map(([branchId, branchSteps], branchIndex) => (_jsxs("div", { style: { marginBottom: 8 }, children: [_jsx("strong", { style: { fontSize: 12 }, children: branchId }), _jsx("div", { style: { fontSize: 11, color: designTokens.color.subtle }, children: branchSteps.map((step) => `${step.title}:${step.status}`).join(" · ") })] }, `${branchId}-${branchIndex}`)))] })), _jsxs("div", { style: { marginTop: 16, borderTop: `1px solid ${designTokens.color.border}`, paddingTop: 12 }, children: [_jsx("div", { style: { fontSize: 11, color: designTokens.color.subtle, marginBottom: 8 }, children: translateMessage("ui.workflowDAG.stepDetails") }), steps.map((step, idx) => (_jsxs("div", { style: { display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 8, alignItems: "center", padding: "4px 0" }, children: [_jsxs("span", { style: { color: designTokens.color.subtle, fontSize: 10 }, children: ["#", idx + 1] }), _jsxs("span", { style: { fontSize: 12, color: designTokens.color.text }, children: [step.title, step.dependsOnStepIds != null && step.dependsOnStepIds.length > 0 ? ` ← ${step.dependsOnStepIds.join(", ")}` : ""] }), _jsx("span", { style: {
                                    fontSize: 10,
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    background: getStepColor(step.status),
                                    color: designTokens.primitive.color.ink950,
                                }, children: step.status })] }, step.id)))] })] }));
}
