export class PlatformWorkbenchSnapshotService {
    buildSnapshot(input) {
        return {
            generatedAt: input.generatedAt ?? new Date().toISOString(),
            onboarding: input.onboarding ?? null,
            dashboard: input.dashboard == null
                ? null
                : {
                    dailySummary: input.dashboard.dailySummary,
                    attentionQueue: input.dashboard.attentionQueue,
                    recentCompletions: input.dashboard.recentCompletions,
                },
            hitlInbox: [...(input.hitlInbox ?? [])],
            approvalQueue: [...(input.approvalQueue ?? [])],
            operatorActions: [...(input.operatorActions ?? defaultOperatorActions(input.dashboard?.attentionQueue ?? []))],
            sdkShortcuts: [...(input.sdkShortcuts ?? [])],
            inventorySummary: {
                benchmarkCount: input.inventorySummary?.benchmarkCount ?? 0,
                projectionCount: input.inventorySummary?.projectionCount ?? 0,
                deploymentCount: input.inventorySummary?.deploymentCount ?? 0,
                judgeCount: input.inventorySummary?.judgeCount ?? 0,
                complianceProgramCount: input.inventorySummary?.complianceProgramCount ?? 0,
            },
        };
    }
}
function defaultOperatorActions(attentionQueue) {
    const hasCriticalAttention = attentionQueue.some((item) => item.priority === "critical");
    return [
        {
            actionId: "open_approvals",
            label: "Open Approval Queue",
            route: "/console/approvals",
            requiredRole: "viewer",
        },
        {
            actionId: "open_stability",
            label: "Open Stability Panel",
            route: "/console/stability",
            requiredRole: "operator",
        },
        {
            actionId: hasCriticalAttention ? "open_takeover_console" : "open_task_board",
            label: hasCriticalAttention ? "Open Takeover Console" : "Open Task Board",
            route: hasCriticalAttention ? "/console/admin/tasks" : "/console",
            requiredRole: hasCriticalAttention ? "admin" : "operator",
        },
    ];
}
//# sourceMappingURL=platform-workbench-snapshot-service.js.map