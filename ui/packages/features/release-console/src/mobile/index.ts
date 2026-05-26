import { createMobileFeatureCard } from "@aa/ui-mobile";

export function createReleaseConsoleMobileCards() {
  return [
    createMobileFeatureCard("Release Console", "查看发布门禁和晋级状态"),
    createMobileFeatureCard("Rollback Plan", "确认回滚计划和证据完整度"),
  ];
}
