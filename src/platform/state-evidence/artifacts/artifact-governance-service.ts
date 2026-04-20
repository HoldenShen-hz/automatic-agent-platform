import type { ArtifactBundleExtended } from "./artifact-model.js";
import { SensitiveContentScanner } from "./sensitive-content-scanner.js";

export interface ArtifactGovernanceDecision {
  allowed: boolean;
  issues: string[];
}

export class ArtifactGovernanceService {
  private readonly scanner: SensitiveContentScanner;

  public constructor(scanner: SensitiveContentScanner = new SensitiveContentScanner()) {
    this.scanner = scanner;
  }

  public review(bundle: ArtifactBundleExtended): ArtifactGovernanceDecision {
    const issues: string[] = [];
    if (bundle.totalSize > 10 * 1024 * 1024) {
      issues.push("artifact.bundle_size_limit_exceeded");
    }
    const sensitiveScan = this.scanner.scanStructured({
      artifacts: bundle.artifacts,
      links: bundle.links,
      finalDeliverables: bundle.finalDeliverables,
    });
    if (sensitiveScan.findings.some((finding) => finding.kind === "secret")) {
      issues.push("artifact.sensitive_secret_detected");
    }
    if (sensitiveScan.findings.some((finding) => finding.kind === "pii")) {
      issues.push("artifact.sensitive_pii_detected");
    }
    return {
      allowed: issues.length === 0,
      issues,
    };
  }
}
