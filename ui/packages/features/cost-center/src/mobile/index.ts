import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { CostReportDTO } from "@aa/shared-types";

export function createCostCenterMobileCards(reports: readonly CostReportDTO[]) {
  return reports.slice(0, 3).map((report) => createMobileFeatureCard(
    report.scope,
    report.budgetUsd == null
      ? `$${report.amountUsd} / budget not published`
      : `$${report.amountUsd} / budget $${report.budgetUsd}`,
  ));
}
