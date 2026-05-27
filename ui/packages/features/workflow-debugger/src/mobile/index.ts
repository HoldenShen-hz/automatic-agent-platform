import { createMobileFeatureCard } from "@aa/ui-mobile";

export function createWorkflowDebuggerMobileCards() {
  return [
    createMobileFeatureCard("Timeline", "Read-only replay baseline"),
    createMobileFeatureCard("Step In", "Phase-by-phase debugger rail"),
    createMobileFeatureCard("Time Travel", "历史回放通道已接线，等待调试数据流接入"),
  ] as const;
}
