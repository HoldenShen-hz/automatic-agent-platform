import type { ArtifactBundleExtended } from "./artifact-model.js";
import { SensitiveContentScanner } from "./sensitive-content-scanner.js";
export interface ArtifactGovernanceDecision {
    allowed: boolean;
    issues: string[];
}
export declare class ArtifactGovernanceService {
    private readonly scanner;
    constructor(scanner?: SensitiveContentScanner);
    review(bundle: ArtifactBundleExtended): ArtifactGovernanceDecision;
}
