/**
 * @fileoverview Data Types - Analytics, archive, replay, data movement, and intelligence records.
 *
 * Contains records related to data analytics, archival, replay datasets,
 * data movement jobs, and intelligence gathering.
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */

import type {
  DataNamespacePlane,
  Timestamp,
} from "./primitives.js";

// ---------------------------------------------------------------------------
// Analytics record
// ---------------------------------------------------------------------------

export interface AnalyticsFactRecord {
  factId: string;
  namespaceId: string;
  tenantId: string | null;
  organizationId: string | null;
  workspaceId: string | null;
  metricName: string;
  dimensionJson: string;
  value: number;
  windowStart: Timestamp;
  windowEnd: Timestamp;
  sourceRef: string;
  capturedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Archive and replay records
// ---------------------------------------------------------------------------

export interface ArchiveBundleRecord {
  bundleId: string;
  namespaceId: string;
  tenantId: string | null;
  organizationId: string | null;
  workspaceId: string | null;
  bundleType: string;
  sourceRefsJson: string;
  summaryRef: string;
  createdAt: Timestamp;
}

export interface ReplayDatasetRecord {
  datasetId: string;
  namespaceId: string;
  tenantId: string | null;
  organizationId: string | null;
  workspaceId: string | null;
  datasetType: string;
  sampleRefsJson: string;
  truthRefsJson: string;
  version: string;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Data movement job record
// ---------------------------------------------------------------------------

export interface DataMovementJobRecord {
  jobId: string;
  tenantId: string | null;
  organizationId: string | null;
  workspaceId: string | null;
  sourceNamespaceId: string;
  targetNamespaceId: string;
  sourcePlane: DataNamespacePlane;
  targetPlane: DataNamespacePlane;
  movementType: "analytics_etl" | "archive_compaction" | "replay_dataset_build" | "artifact_lifecycle_move";
  inputRefsJson: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startedAt: Timestamp;
  finishedAt: Timestamp | null;
  reportJson: string | null;
}

// ---------------------------------------------------------------------------
// Intelligence records
// ---------------------------------------------------------------------------

export interface IntelItemRecord {
  intelId: string;
  tenantId: string | null;
  sourceId: string;
  title: string;
  summary: string;
  rawRef: string;
  relevanceScore: number;
  importance: number;
  tagsJson: string;
  dedupeKey: string;
  capturedAt: Timestamp;
  expiresAt: Timestamp | null;
}

export interface IntelBriefRecord {
  briefId: string;
  tenantId: string | null;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  sourceScopeJson: string;
  itemIdsJson: string;
  overallSummary: string;
  recommendedActionsJson: string;
  generatedAt: Timestamp;
}
