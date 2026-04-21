function selectModelTier(stage, riskLevel) {
    if (stage === "review" || stage === "validate" || stage === "release") {
        return riskLevel === "low" ? "standard" : "strong";
    }
    if (stage === "plan" || stage === "repair") {
        return riskLevel === "high" ? "strong" : "standard";
    }
    return "cheap";
}
function unique(values) {
    return Array.from(new Set(values));
}
export class AgentTeamService {
    buildPlan(input) {
        const riskLevel = input.riskLevel ?? "medium";
        const workflow = input.workflow;
        const buildLanes = workflow.executionSteps.map((step) => ({
            laneId: `lane:${step.stepId}`,
            stage: "build",
            ownerRoleId: step.roleId,
            agentId: step.agentId,
            modelTier: selectModelTier("build", riskLevel),
            responsibilities: [
                `Execute workflow step ${step.stepId}`,
                `Produce output ${step.outputKey}`,
            ],
            allowedTools: unique([
                "read",
                "glob",
                "grep",
                ...(step.compensationModel != null ? ["apply_patch"] : []),
            ]),
        }));
        const lanes = [
            {
                laneId: "lane:planner",
                stage: "plan",
                ownerRoleId: "workflow_planner",
                agentId: "agent_workflow_planner",
                modelTier: selectModelTier("plan", riskLevel),
                responsibilities: [
                    "Build dependency graph",
                    "Freeze allowed execution scope",
                ],
                allowedTools: ["read", "glob", "grep", "repo_map"],
            },
            ...buildLanes,
            {
                laneId: "lane:review",
                stage: "review",
                ownerRoleId: "reviewer",
                agentId: "agent_reviewer",
                modelTier: selectModelTier("review", riskLevel),
                responsibilities: [
                    "Review patch bundle and artifacts",
                    "Reject unsafe or out-of-scope changes",
                ],
                allowedTools: ["read", "grep", "repo_map", "diagnostics"],
            },
            {
                laneId: "lane:validator",
                stage: "validate",
                ownerRoleId: "validator",
                agentId: "agent_validator",
                modelTier: selectModelTier("validate", riskLevel),
                responsibilities: [
                    "Run typecheck/test/security validation",
                    "Produce validation decision",
                ],
                allowedTools: ["diagnostics", "read"],
            },
            {
                laneId: "lane:repair",
                stage: "repair",
                ownerRoleId: "repairer",
                agentId: "agent_repairer",
                modelTier: selectModelTier("repair", riskLevel),
                responsibilities: [
                    "Repair only within allowed fix scope",
                    "Consume structured failure evidence package",
                ],
                allowedTools: ["read", "apply_patch", "diagnostics"],
            },
            {
                laneId: "lane:release",
                stage: "release",
                ownerRoleId: "release_guard",
                agentId: "agent_release_guard",
                modelTier: selectModelTier("release", riskLevel),
                responsibilities: [
                    "Approve release or escalate to human review",
                ],
                allowedTools: ["read"],
            },
        ];
        return {
            teamId: `team:${workflow.workflow.workflowId}:${input.taskId}`,
            taskId: input.taskId,
            workflowId: workflow.workflow.workflowId,
            riskLevel,
            lanes,
            executionLoop: ["plan", "build", "review", "validate", "repair", "validate", "release"],
        };
    }
}
//# sourceMappingURL=agent-team-service.js.map