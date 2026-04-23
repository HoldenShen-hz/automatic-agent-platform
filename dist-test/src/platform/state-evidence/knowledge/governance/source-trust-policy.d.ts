import type { SourceTrustPolicy, TrustLevel } from "../knowledge-model.js";
export declare class SourceTrustPolicyRegistry {
    get(level: TrustLevel): SourceTrustPolicy;
}
