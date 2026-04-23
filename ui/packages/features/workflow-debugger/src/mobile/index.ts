import { createMobileFeatureCard } from "@aa/ui-mobile";

export function createWorkflowDebuggerMobileCards() {
  return [
    createMobileFeatureCard("Timeline", "Read-only replay baseline"),
    createMobileFeatureCard("Step In", "Phase-by-phase debugger rail"),
    createMobileFeatureCard("Time Travel", "Awaiting backend debugger seam"),
  ] as const;
}
