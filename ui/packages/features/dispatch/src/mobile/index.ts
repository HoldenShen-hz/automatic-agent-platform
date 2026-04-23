import { createMobileFeatureCard } from "@aa/ui-mobile";

export function createDispatchMobileCards() {
  return [
    createMobileFeatureCard("Dispatch Queue", "Start and reroute execution"),
    createMobileFeatureCard("Replay", "Repair and replay actions"),
    createMobileFeatureCard("Escalation", "Human-supervised dispatch"),
  ] as const;
}
