import { createMobileFeatureCard } from "@aa/ui-mobile";

export interface DivisionInventoryMobileSummaryInput {
  readonly totalDivisions: number;
  readonly blockedDivisions: number;
  readonly orphanSourceModules: number;
}

export function createDivisionInventoryMobileCards(input: DivisionInventoryMobileSummaryInput) {
  return [
    createMobileFeatureCard("Divisions", String(input.totalDivisions)),
    createMobileFeatureCard("Blocked", String(input.blockedDivisions)),
    createMobileFeatureCard("Orphans", String(input.orphanSourceModules)),
  ] as const;
}
