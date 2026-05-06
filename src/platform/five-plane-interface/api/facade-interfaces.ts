/**
 * @fileoverview Facade interfaces for P4/P5 service abstractions.
 *
 * These interfaces allow the interface layer (P1) to depend on abstractions
 * rather than concrete P4/P5 implementations, maintaining architectural boundaries.
 *
 * Part of P2.13: Cross-plane import violations
 */

// ─── Types shared across facades ────────────────────────────────────────────

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "acknowledged" | "mitigating" | "resolved";

export interface IncidentCase {
  incidentId: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  linkedEvidenceRefs: string[];
  owner: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

// ─── Coordinator Load Balancing (P4) ────────────────────────────────────────

export interface CoordinatorSelectionInput {
  queueName?: string | null;
  preferredRegion?: string | null;
  tenantId?: string | null;
  requestKey?: string | null;
}

export interface CoordinatorSelectionEvaluation {
  coordinatorId: string;
  eligible: boolean;
  score: number | null;
  reasonCode: string | null;
}

export interface CoordinatorSelectionDecision {
  outcome: "selected" | "no_candidate";
  selectedCoordinatorId: string | null;
  reasonCode: string | null;
  evaluations: CoordinatorSelectionEvaluation[];
}

export interface CoordinatorLoadBalancingSummary {
  generatedAt: string;
  coordinatorCount: number;
  activeCount: number;
  drainingCount: number;
  offlineCount: number;
  totalCapacity: number;
  totalActiveDispatchCount: number;
  totalBacklogCount: number;
  regions: string[];
  hotCoordinatorIds: string[];
}

/**
 * Abstraction for coordinator load balancing operations (P4).
 */
export interface ApiDelegationService {
  buildSummary(generatedAt?: string): CoordinatorLoadBalancingSummary;
  selectCoordinator(input?: CoordinatorSelectionInput): CoordinatorSelectionDecision;
}

// ─── Artifact Plane (P5) ────────────────────────────────────────────────────

export interface ArtifactLink {
  ref: string;
  type: string;
}

export interface ArtifactRecord {
  artifactId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  storageRef: string;
  createdAt: string;
}

export type ArtifactBundleType = "release_bundle" | "asset_bundle" | "campaign_bundle" | "incident_bundle";

export interface ArtifactBundleExtended {
  bundleId: string;
  bundleType: ArtifactBundleType;
  taskId: string;
  domainId: string;
  artifacts: ArtifactRecord[];
  links: ArtifactLink[];
  finalDeliverables: string[];
  createdAt: string;
}

export interface ArtifactGovernanceDecision {
  allowed: boolean;
  issues: string[];
}

export interface ArtifactPlaneBundleResult {
  bundle: ArtifactBundleExtended;
  governance: ArtifactGovernanceDecision;
  preview: string;
}

export interface ArtifactPublishLedgerEntry {
  publishedAt: string;
  bundleId: string;
  bundleType: ArtifactBundleType;
  domainId: string;
  artifactCount: number;
}

/**
 * Abstraction for artifact plane operations (P5).
 */
export interface ArtifactFacadeService {
  prepareBundle(input: {
    taskId: string;
    domainId: string;
    bundleType: ArtifactBundleType;
    artifacts: readonly ArtifactRecord[];
    links?: readonly ArtifactLink[];
    finalDeliverables?: readonly string[];
  }): ArtifactPlaneBundleResult;
  publishBundle(bundle: ArtifactBundleExtended): ArtifactPlaneBundleResult;
  listPublishHistory(): ArtifactPublishLedgerEntry[];
}

// ─── Knowledge Plane (P5) ───────────────────────────────────────────────────

export interface RetrievalHit {
  chunkId: string;
  documentId: string;
  score: number;
  matchType: "semantic" | "keyword" | "structural";
  snippet: string;
  namespace: string;
  knowledgeRef: string;
}

export interface KnowledgeQueryOptions {
  namespace?: string;
  limit?: number;
  domainId?: string;
  includePluginRetrieval?: boolean;
}

/**
 * Abstraction for knowledge plane operations (P5).
 */
export interface KnowledgeFacadeService {
  listNamespaces(): string[];
  queryForDomain(
    keyword: string,
    options: KnowledgeQueryOptions & { domainId: string },
  ): Promise<RetrievalHit[]>;
  queryAsync(keyword: string, options?: KnowledgeQueryOptions): Promise<RetrievalHit[]>;
  inspectGraph(options: {
    namespace?: string;
    knowledgeRef?: string;
    keyword?: string;
    limit?: number;
  }): unknown;
  inspectSemanticInfrastructure(): unknown;
  inspectNamespace(namespace: string): unknown;
}

// ─── Incident Plane (P5) ────────────────────────────────────────────────────

/**
 * Abstraction for incident case operations (P5).
 */
export interface IncidentFacadeService {
  listIncidents(tenantId: string | undefined, limit?: number): IncidentCase[];
  countIncidents(tenantId: string | undefined): number;
  getIncident(tenantId: string | undefined, incidentId: string): IncidentCase | null;
  openIncident(input: {
    tenantId: string | null;
    severity: IncidentSeverity;
    title: string;
    linkedEvidenceRefs?: string[];
  }): IncidentCase;
  // R14-17: acknowledge, startMitigation, resolve must receive tenantId to enforce tenant scoping
  acknowledge(tenantId: string | undefined, incidentId: string, owner: string): IncidentCase;
  startMitigation(tenantId: string | undefined, incidentId: string): IncidentCase;
  resolve(tenantId: string | undefined, incidentId: string): IncidentCase;
}

// ─── No-op implementations for defaults ─────────────────────────────────────

/**
 * No-op implementation of IncidentFacadeService for when no service is configured.
 * Used as a default when incidentService is not provided.
 */
class NoOpIncidentFacadeService implements IncidentFacadeService {
  public listIncidents(_tenantId: string | undefined, limit?: number): IncidentCase[] {
    return [];
  }
  public countIncidents(_tenantId: string | undefined): number {
    return 0;
  }
  public getIncident(_tenantId: string | undefined, _incidentId: string): IncidentCase | null {
    return null;
  }
  public openIncident(input: { tenantId: string | null; severity: IncidentSeverity; title: string; linkedEvidenceRefs?: string[] }): IncidentCase {
    throw new Error("Incident service not configured");
  }
  // R14-17: acknowledge, startMitigation, resolve must receive tenantId to enforce tenant scoping
  public acknowledge(_tenantId: string | undefined, _incidentId: string, _owner: string): IncidentCase {
    throw new Error("Incident service not configured");
  }
  public startMitigation(_tenantId: string | undefined, _incidentId: string): IncidentCase {
    throw new Error("Incident service not configured");
  }
  public resolve(_tenantId: string | undefined, _incidentId: string): IncidentCase {
    throw new Error("Incident service not configured");
  }
}

export function createNoOpIncidentFacadeService(): IncidentFacadeService {
  return new NoOpIncidentFacadeService();
}
