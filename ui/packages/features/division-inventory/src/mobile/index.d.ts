export interface DivisionInventoryMobileSummaryInput {
    readonly totalDivisions: number;
    readonly blockedDivisions: number;
    readonly orphanSourceModules: number;
}
export declare function createDivisionInventoryMobileCards(input: DivisionInventoryMobileSummaryInput): readonly import("@aa/ui-mobile").MobileFeatureCard[];
