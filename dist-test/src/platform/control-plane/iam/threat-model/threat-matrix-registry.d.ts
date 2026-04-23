import { type StrideCategory, type ThreatEntry, type ThreatMatrix } from "./stride-framework.js";
export declare class ThreatMatrixRegistry {
    private readonly matrix;
    constructor(matrix?: ThreatMatrix);
    getMatrix(): ThreatMatrix;
    listCategories(): readonly StrideCategory[];
    listByCategory(category: StrideCategory): ThreatEntry[];
    validate(): {
        valid: boolean;
        missingCategories: StrideCategory[];
    };
}
export declare const defaultThreatMatrixRegistry: ThreatMatrixRegistry;
