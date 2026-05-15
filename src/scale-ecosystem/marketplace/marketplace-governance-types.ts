import type { ArtifactStoreOptions } from "../../platform/five-plane-state-evidence/artifacts/artifact-store.js";
import type {
  ArtifactRef,
  ExtensionLifecycleState,
  ExtensionPackageType,
  ExtensionTrustLevel,
  MarketplaceGovernanceReportRecord,
  MarketplacePublicationStatus,
  MarketplaceReviewStatus,
} from "../../platform/contracts/types/domain.js";

export interface RegisterExtensionPackageInput {
  packageId?: string;
  tenantId?: string | null;
  extensionId: string;
  packageType: ExtensionPackageType;
  displayName: string;
  version: string;
  owner: string;
  trustLevel: ExtensionTrustLevel;
  sourceUri: string;
  capabilities: string[];
  permissions: string[];
  compatibility: {
    apiContract: string;
    permissionSurface: string;
    runtimeCapability: string;
  };
  signatureVerified: boolean;
  sbomVerified?: boolean;
  sandboxCertVerified?: boolean;
  egressPolicyCompliant?: boolean;
  manifestChecksum: string;
  lifecycleState?: ExtensionLifecycleState;
  reviewRequired?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubmitMarketplaceReviewInput {
  reviewId?: string;
  tenantId?: string | null;
  packageId: string;
  submitter: string;
  findings?: string[];
  submittedAt?: string;
}

export interface DecideMarketplaceReviewInput {
  reviewId: string;
  tenantId?: string | null;
  status: Extract<MarketplaceReviewStatus, "approved" | "rejected">;
  reviewer: string;
  decisionReasonCode: string;
  findings?: string[];
  decidedAt?: string;
}

export interface PublishExtensionInput {
  publicationId?: string;
  tenantId?: string | null;
  packageId: string;
  reviewId?: string;
  channel?: string;
  publishedAt?: string;
}

export interface RevokeExtensionInput {
  publicationId: string;
  tenantId?: string | null;
  reasonCode: string;
  revokedAt?: string;
}

export interface DeprecateExtensionInput {
  packageId: string;
  tenantId?: string | null;
  reasonCode: string;
  migrationTarget?: string | null;
  replacementSuggestions?: readonly string[];
  deprecatedAt?: string;
}

export interface SunsetExtensionInput {
  packageId: string;
  tenantId?: string | null;
  reasonCode: string;
  sunsetAt: string;
  endOfLifeAt: string | null;
  thresholdConditions?: readonly {
    conditionId: string;
    description: string;
    severityThreshold: "low" | "medium" | "high" | "critical";
    actionOnTrigger: "immediate_eol" | "extend_grace_period" | "none";
  }[];
  migrationTarget?: string | null;
  replacementSuggestions?: readonly string[];
}

export interface RetireExtensionInput {
  packageId: string;
  tenantId?: string | null;
  reasonCode: string;
  migrationCompletionRatio?: number;
  retiredAt?: string;
}

export interface MarketplaceCatalogEntry {
  packageId: string;
  tenantId: string | null;
  extensionId: string;
  packageType: ExtensionPackageType;
  displayName: string;
  version: string;
  owner: string;
  trustLevel: ExtensionTrustLevel;
  signatureVerified: boolean;
  lifecycleState: ExtensionLifecycleState;
  reviewStatus: MarketplaceReviewStatus | "missing";
  publicationStatus: MarketplacePublicationStatus | "unpublished";
  channel: string | null;
  reasonCodes: string[];
  compatibility: {
    apiContract: string;
    permissionSurface: string;
    runtimeCapability: string;
  };
  capabilities: string[];
  permissions: string[];
  migrationTarget?: string | null;
  replacementSuggestions?: readonly string[];
}

export interface MarketplaceCatalogSummary {
  packagesReady: number;
  reviewPending: number;
  blocked: number;
  revoked: number;
  total: number;
  overallVerdict: "ready" | "partial" | "blocked";
}

export interface MarketplaceCatalogReport {
  reportId: string;
  generatedAt: string;
  tenantId: string | null;
  summary: MarketplaceCatalogSummary;
  entries: MarketplaceCatalogEntry[];
}

export interface MarketplaceGovernanceRunResult {
  report: MarketplaceCatalogReport;
  record: MarketplaceGovernanceReportRecord;
}

export interface MarketplaceGovernanceExportResult extends MarketplaceGovernanceRunResult {
  jsonArtifact: ArtifactRef;
  markdownArtifact: ArtifactRef;
}

export interface MarketplaceGovernanceServiceOptions {
  artifactStoreOptions?: ArtifactStoreOptions;
}
