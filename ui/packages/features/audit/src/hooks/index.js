export function useAuditVm() {
    return {
        items: [
            { title: "Change Timeline", description: "按时间线查看配置、审批、发布与接管操作。" },
            { title: "Evidence Export", description: "导出审计证据、审批记录与执行摘要。" },
            { title: "Actor Trace", description: "追踪用户、代理与自动化动作的来源与影响面。" },
        ],
    };
}
