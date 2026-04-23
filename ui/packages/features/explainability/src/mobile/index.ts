import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { ExplanationDTO } from "@aa/shared-types";

export function createExplainabilityMobileCards(items: readonly ExplanationDTO[]) {
  return items.slice(0, 3).map((item) => createMobileFeatureCard(
    item.title,
    `${item.evidenceCount} evidence`,
  ));
}
