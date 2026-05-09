/**
 * Compliance Module - GDPR Right-to-Erasure and Data Residency Enforcement
 *
 * This module provides compliance services for:
 * - ErasureRequestService: GDPR Article 17 Right-to-Erasure request handling
 * - ErasureReportService: Erasure compliance report generation
 * - DataEncryptionKeyService: Per-tenant DEK management for crypto-shredding
 * - DataResidencyService: Data residency enforcement and jurisdiction mapping
 *
 * ## Architecture
 *
 * The compliance module integrates with:
 * - AuthoritativeTaskStore for persistence
 * - Event system for audit trail
 * - DEK management for crypto-shredding
 * - Data residency rules for jurisdiction enforcement
 *
 * @see docs_zh/architecture/00-platform-architecture.md
 * @packageDocumentation
 */

// R23-76: Canonical compliance types for contract alignment

/**
 * EvidenceMappingRule - Maps evidence to compliance requirements
 */
export interface EvidenceMappingRule {
  ruleId: string;
  frameworkId: string;
  controlId: string;
  evidenceType: string;
  mappingExpression: string;
  artifactPatterns: readonly string[];
  requiredFields: readonly string[];
  confidenceThreshold: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * ComplianceReportRequest - Request for generating a compliance report
 */
export interface ComplianceReportRequest {
  requestId: string;
  tenantId: string;
  frameworkId: string;
  scope: "tenant" | "domain" | "execution" | "task";
  scopeId: string | null;
  periodStart: string;
  periodEnd: string;
  includeArtifacts: boolean;
  includeEvidence: boolean;
  requestedBy: string;
  createdAt: string;
  metadataJson: string | null;
}

/**
 * Artifact - Evidence artifact for compliance tracking
 */
export interface Artifact {
  artifactId: string;
  artifactType: "execution_log" | "audit_event" | "checkpoint" | "workflow_state" | "task_output" | "manual_override" | "system_snapshot";
  tenantId: string;
  taskId: string | null;
  executionId: string | null;
  artifactRef: string;
  contentHash: string;
  sizeBytes: number;
  capturedAt: string;
  retentionDays: number;
  expiresAt: string | null;
  metadataJson: string | null;
}

/**
 * EvidenceRecord - Individual evidence record for compliance
 */
export interface EvidenceRecord {
  recordId: string;
  tenantId: string;
  frameworkId: string;
  controlId: string;
  evidenceType: string;
  artifactId: string | null;
  recordHash: string;
  collectedAt: string;
  collectedBy: string;
  validationStatus: "pending" | "validated" | "failed" | "not_applicable";
  validationMessage: string | null;
  metadataJson: string | null;
}

/**
 * AuditAppendCommand - Command to append audit records
 */
export interface AuditAppendCommand {
  commandId: string;
  tenantId: string;
  auditEventType: string;
  actorId: string;
  actorType: "user" | "system" | "operator" | "agent";
  resourceKind: string;
  resourceId: string;
  action: string;
  result: "success" | "failure" | "partial";
  metadataJson: string | null;
  traceId: string | null;
  occurredAt: string;
  createdAt: string;
}

// Erasure Request Service
export {
  ErasureRequestService,
  type ErasureRequest,
  type ErasureRequestInput,
  type ErasureStatus,
  type ErasureSubjectType,
  type EvidenceRef,
} from "./erasure-request-service.js";

// Erasure Report Service
export {
  ErasureReportService,
  type ErasureReport,
  type ErasureSubject,
  type ReportEvidenceRef,
  type ReportSubjectType,
  type GenerateErasureReportInput,
  type CryptoShreddingVerificationSummary,
} from "./erasure-report-service.js";

// Data Encryption Key Service
export {
  DataEncryptionKeyService,
  type DataEncryptionKey,
  type CreateDekInput,
  type RotateDekInput,
  type DestroyDekInput,
  type TenantDekSummary,
  type DekStatus,
} from "./data-encryption-key-service.js";

// Data Residency Service
export {
  DataResidencyService,
  type DataResidencyRule,
  type DataPlacement,
  type ResidencyViolation,
  type CheckResidencyInput,
  type ValidatePlacementInput,
  type ResidencyCheckResult,
  type Jurisdiction,
  type DataRegion,
  type DataCategory,
} from "./data-residency-service.js";