/**
 * Stable Evidence Bundle
 */
export * from "./stable-evidence-bundle-support.js";
import { type StableEvidenceBundleOptions, type StableEvidenceBundleReport } from "./stable-evidence-bundle-support.js";
export declare function createStableEvidenceBundle(options: StableEvidenceBundleOptions): Promise<StableEvidenceBundleReport>;
