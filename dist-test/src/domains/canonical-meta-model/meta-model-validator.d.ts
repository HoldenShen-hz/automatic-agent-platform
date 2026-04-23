import { type DomainMetaModel, type MetaModelValidationResult } from "./types.js";
export declare function computeMetaModelCompleteness(model: DomainMetaModel): number;
export declare class MetaModelValidator {
    validate(model: DomainMetaModel): MetaModelValidationResult;
}
