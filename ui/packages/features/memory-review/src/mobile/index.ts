import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";

export function createMemoryReviewMobileCards() {
  return [
    createMobileFeatureCard(translateMessage("ui.memoryReview.mobile.review.title"), translateMessage("ui.memoryReview.mobile.review.description")),
    createMobileFeatureCard(translateMessage("ui.memoryReview.mobile.lineage.title"), translateMessage("ui.memoryReview.mobile.lineage.description")),
  ];
}
