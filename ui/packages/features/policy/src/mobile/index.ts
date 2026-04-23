import { createMobileFeatureCard } from "@aa/ui-mobile";

export function createPolicyMobileCards() {
  return [
    createMobileFeatureCard("Approval", "Risk-based approval gates"),
    createMobileFeatureCard("Action", "Confirm / deny action policy"),
    createMobileFeatureCard("Visibility", "Role and domain visibility control"),
  ] as const;
}
