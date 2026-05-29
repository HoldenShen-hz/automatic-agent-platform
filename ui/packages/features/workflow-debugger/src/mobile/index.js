import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createWorkflowDebuggerMobileCards() {
    return [
        createMobileFeatureCard("时间线", "只读回放基线"),
        createMobileFeatureCard("逐步执行", "按阶段展开的调试轨道"),
        createMobileFeatureCard("时间旅行", "历史回放通道已接线，等待调试数据流接入"),
    ];
}
