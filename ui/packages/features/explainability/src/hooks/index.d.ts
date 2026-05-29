import type { ExplanationDTO } from "@aa/shared-types";
export interface ExplainabilityVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
}
export declare function mapExplanationsToVm(items: readonly ExplanationDTO[]): ExplainabilityVm;
export declare function useExplainabilityVm(): ExplainabilityVm;
