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

export interface ComplianceArtifact {
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

export interface ComplianceEvidenceRecord {
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

export interface ComplianceAuditAppendCommand {
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
