export function usePolicyVm() {
    return {
        items: [
            { title: "Approval Policy", description: "按风险等级、域和租户定义审批门禁。" },
            { title: "Action Policy", description: "定义 task.cancel、workflow.publish 等动作的确认与禁止规则。" },
            { title: "Feature Visibility", description: "按角色与域控制工作台功能显隐。" },
        ],
    };
}
