import { createMobileFeatureCard } from "@aa/ui-mobile";

export function createTraceExplorerMobileCards() {
  return [
    createMobileFeatureCard("Trace Explorer", "查看 trace 时间线和 receipt 关联"),
    createMobileFeatureCard("Restricted Access", "检查受限 trace 的访问审计"),
  ];
}
