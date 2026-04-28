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
    const sensitiveScan = this.scanner.scanStructured(buildGovernanceScanPayload(bundle));
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

function buildGovernanceScanPayload(bundle: ArtifactBundleExtended): Record<string, unknown> {
  const artifactPathById = new Map(bundle.artifacts.map((artifact) => [artifact.artifactId, artifact.path]));
  return {
    bundleType: bundle.bundleType,
    domainId: bundle.domainId,
    artifacts: bundle.artifacts.map((artifact) => ({
      type: artifact.type,
      path: artifact.path,
      status: artifact.status,
      agentRole: artifact.agentRole,
      stepId: artifact.stepId,
    })),
    links: bundle.links.map((link) => ({
      relation: link.relation,
    })),
    finalDeliverables: bundle.finalDeliverables
      .map((deliverable) => artifactPathById.get(deliverable) ?? deliverable)
      .filter((deliverable) => !looksLikeInternalReference(deliverable)),
  };
}

function looksLikeInternalReference(value: string): boolean {
  return /^[a-z][a-z0-9]*_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
