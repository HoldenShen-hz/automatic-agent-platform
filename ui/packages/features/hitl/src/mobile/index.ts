import { createMobileFeatureCard } from "@aa/ui-mobile";

export function createHitlMobileCards() {
  return [
    createMobileFeatureCard("Inspect", "View current plan and execution"),
    createMobileFeatureCard("Takeover", "Manual override with audit trail"),
    createMobileFeatureCard("Resume", "Normal / replan / supervised / abort"),
  ] as const;
}
