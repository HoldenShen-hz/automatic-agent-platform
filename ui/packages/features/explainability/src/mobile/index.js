import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createExplainabilityMobileCards(items) {
    return items.slice(0, 3).map((item) => createMobileFeatureCard(item.title, `${item.evidenceCount} evidence`));
}
