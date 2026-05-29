import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createCostCenterMobileCards(reports) {
    return reports.slice(0, 3).map((report) => createMobileFeatureCard(report.scope, `$${report.amountUsd} / budget $${report.budgetUsd}`));
}
