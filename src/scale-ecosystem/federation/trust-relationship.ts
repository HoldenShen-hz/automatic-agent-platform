/**
 * Trust Relationship
 * Trust model between organizations
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { newId } from "../../platform/contracts/types/ids.js";
import { TrustLevel } from "./trust-level.js";

export { TrustLevel } from "./trust-level.js";

// Types
export interface TrustMetrics {
  lastInteraction?: Date;
  successfulInteractions: number;
  failedInteractions: number;
  averageLatencyMs: number;
  uptimePercentage: number;
  trustScore: number;
}

export interface TrustPolicy {
  id: string;
  name: string;
  description: string;
  minTrustLevel: TrustLevel;
  maxDelegationDepth: number;
  allowedCapabilities: string[];
  requiredCapabilities: string[];
  autoRevokeAfterDays?: number;
  requirePeriodicReauth: boolean;
  reauthIntervalDays: number;
  metadata?: Record<string, unknown>;
}

export interface TrustEvaluation {
  trustId: string;
  orgId: string;
  targetOrgId: string;
  evaluatedAt: Date;
  trustScore: number;
  factors: TrustFactor[];
  recommendation: "grant" | "review" | "deny";
  reason: string;
}

export interface TrustFactor {
  name: string;
  weight: number;
  value: number;
  contribution: number;
  description: string;
}

export type TrustEventType =
  | "trust.established"
  | "trust.renewed"
  | "trust.suspended"
  | "trust.revoked"
  | "trust.degraded"
  | "trust.elevated";

export interface TrustEvent {
  id: string;
  trustId: string;
  type: TrustEventType;
  timestamp: Date;
  previousScore?: number;
  newScore?: number;
  actor?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface TrustRelationship {
  id: string;
  sourceOrgId: string;
  targetOrgId: string;
  level: TrustLevel;
  capabilities: string[];
  metrics: TrustMetrics;
  policy: TrustPolicy;
  createdAt: Date;
  expiresAt?: Date;
  lastVerifiedAt?: Date;
  status: TrustStatus;
}

export type TrustStatus = "active" | "suspended" | "revoked" | "expired";

export interface TrustRelationshipStorageOptions {
  readonly persistent?: boolean;
  readonly storageDir?: string;
}

interface PersistedTrustMetrics {
  lastInteraction?: string;
  successfulInteractions: number;
  failedInteractions: number;
  averageLatencyMs: number;
  uptimePercentage: number;
  trustScore: number;
}

interface PersistedTrustEvent {
  id: string;
  trustId: string;
  type: TrustEventType;
  timestamp: string;
  previousScore?: number;
  newScore?: number;
  actor?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

interface PersistedTrustRelationship {
  id: string;
  sourceOrgId: string;
  targetOrgId: string;
  level: TrustLevel;
  capabilities: string[];
  metrics: PersistedTrustMetrics;
  policy: TrustPolicy;
  createdAt: string;
  expiresAt?: string;
  lastVerifiedAt?: string;
  status: TrustStatus;
}

interface PersistedTrustSnapshot {
  policies: TrustPolicy[];
  relationships: PersistedTrustRelationship[];
  events: PersistedTrustEvent[];
}

const DEFAULT_TRUST_STORAGE_DIR =
  process.env.AA_FEDERATION_TRUST_DIR?.trim() || join(process.cwd(), ".runtime", "federation", "trust");

function isTestRuntime(): boolean {
  return process.env.AA_RUNNING_TESTS === "1"
    || process.env.NODE_TEST_CONTEXT === "child-v8"
    || process.env.VITEST === "true";
}

function serializeMetrics(metrics: TrustMetrics): PersistedTrustMetrics {
  const serialized: PersistedTrustMetrics = {
    successfulInteractions: metrics.successfulInteractions,
    failedInteractions: metrics.failedInteractions,
    averageLatencyMs: metrics.averageLatencyMs,
    uptimePercentage: metrics.uptimePercentage,
    trustScore: metrics.trustScore,
  };
  if (metrics.lastInteraction != null) {
    serialized.lastInteraction = metrics.lastInteraction.toISOString();
  }
  return serialized;
}

function deserializeMetrics(metrics: PersistedTrustMetrics): TrustMetrics {
  const deserialized: TrustMetrics = {
    successfulInteractions: metrics.successfulInteractions,
    failedInteractions: metrics.failedInteractions,
    averageLatencyMs: metrics.averageLatencyMs,
    uptimePercentage: metrics.uptimePercentage,
    trustScore: metrics.trustScore,
  };
  if (metrics.lastInteraction != null) {
    deserialized.lastInteraction = new Date(metrics.lastInteraction);
  }
  return deserialized;
}

function serializeEvent(event: TrustEvent): PersistedTrustEvent {
  return {
    ...event,
    timestamp: event.timestamp.toISOString(),
  };
}

function deserializeEvent(event: PersistedTrustEvent): TrustEvent {
  return {
    ...event,
    timestamp: new Date(event.timestamp),
  };
}

function serializeRelationship(relationship: TrustRelationship): PersistedTrustRelationship {
  const serialized: PersistedTrustRelationship = {
    id: relationship.id,
    sourceOrgId: relationship.sourceOrgId,
    targetOrgId: relationship.targetOrgId,
    level: relationship.level,
    capabilities: [...relationship.capabilities],
    metrics: serializeMetrics(relationship.metrics),
    policy: relationship.policy,
    createdAt: relationship.createdAt.toISOString(),
    status: relationship.status,
  };
  if (relationship.expiresAt != null) {
    serialized.expiresAt = relationship.expiresAt.toISOString();
  }
  if (relationship.lastVerifiedAt != null) {
    serialized.lastVerifiedAt = relationship.lastVerifiedAt.toISOString();
  }
  return serialized;
}

function deserializeRelationship(relationship: PersistedTrustRelationship): TrustRelationship {
  const deserialized: TrustRelationship = {
    id: relationship.id,
    sourceOrgId: relationship.sourceOrgId,
    targetOrgId: relationship.targetOrgId,
    level: relationship.level,
    capabilities: [...relationship.capabilities],
    metrics: deserializeMetrics(relationship.metrics),
    policy: relationship.policy,
    createdAt: new Date(relationship.createdAt),
    status: relationship.status,
  };
  if (relationship.expiresAt != null) {
    deserialized.expiresAt = new Date(relationship.expiresAt);
  }
  if (relationship.lastVerifiedAt != null) {
    deserialized.lastVerifiedAt = new Date(relationship.lastVerifiedAt);
  }
  return deserialized;
}

/**
 * TrustRelationshipManager manages trust relationships between organizations.
 * It handles trust establishment, evaluation, monitoring, and revocation.
 */
export class TrustRelationshipManager {
  private readonly relationships: Map<string, TrustRelationship> = new Map();
  private readonly policies: Map<string, TrustPolicy> = new Map();
  private readonly events: TrustEvent[] = [];
  private readonly indexByOrg: Map<string, Set<string>> = new Map();
  private readonly persistent: boolean;
  private readonly storageDir: string;
  private readonly snapshotPath: string;

  constructor(
    policies: TrustPolicy[] = [],
    storageOptions: TrustRelationshipStorageOptions = {},
  ) {
    this.persistent = storageOptions.persistent ?? !isTestRuntime();
    this.storageDir = storageOptions.storageDir ?? DEFAULT_TRUST_STORAGE_DIR;
    this.snapshotPath = join(this.storageDir, "trust-relationships.json");

    if (this.persistent) {
      this.loadFromDisk();
    }

    for (const policy of policies) {
      this.policies.set(policy.id, policy);
    }

    if (policies.length > 0) {
      this.persistSnapshot();
    }
  }

  private ensureStorageDir(): void {
    mkdirSync(this.storageDir, { recursive: true });
  }

  private loadFromDisk(): void {
    if (!existsSync(this.snapshotPath)) {
      return;
    }
    const raw = readFileSync(this.snapshotPath, "utf8").trim();
    if (raw.length === 0) {
      return;
    }
    const parsed = JSON.parse(raw) as PersistedTrustSnapshot;
    this.relationships.clear();
    this.policies.clear();
    this.events.length = 0;
    for (const policy of parsed.policies ?? []) {
      this.policies.set(policy.id, policy);
    }
    for (const relationship of parsed.relationships ?? []) {
      this.relationships.set(relationship.id, deserializeRelationship(relationship));
    }
    for (const event of parsed.events ?? []) {
      this.events.push(deserializeEvent(event));
    }
    this.rebuildIndices();
  }

  private persistSnapshot(): void {
    if (!this.persistent) {
      return;
    }
    this.ensureStorageDir();
    const snapshot: PersistedTrustSnapshot = {
      policies: [...this.policies.values()],
      relationships: [...this.relationships.values()].map(serializeRelationship),
      events: this.events.map(serializeEvent),
    };
    writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
  }

  // Trust Relationship Operations
  async createTrustRelationship(params: {
    sourceOrgId: string;
    targetOrgId: string;
    level: TrustLevel;
    capabilities: string[];
    policyId?: string;
    expiresAt?: Date;
  }): Promise<TrustRelationship> {
    const id = newId("trust_relationship");
    const policy = params.policyId
      ? this.policies.get(params.policyId)
      : this.getDefaultPolicy(params.level);

    if (!policy) {
      throw new Error(`Trust policy not found: ${params.policyId}`);
    }

    const relationship: TrustRelationship = {
      id,
      sourceOrgId: params.sourceOrgId,
      targetOrgId: params.targetOrgId,
      level: params.level,
      capabilities: [...params.capabilities],
      metrics: this.createInitialMetrics(),
      policy,
      createdAt: new Date(),
      ...(params.expiresAt !== undefined ? { expiresAt: params.expiresAt } : {}),
      lastVerifiedAt: new Date(),
      status: "active",
    };

    this.relationships.set(id, relationship);
    this.indexOrg(relationship);
    this.recordEvent({
      id: newId("trust_event"),
      trustId: id,
      type: "trust.established",
      timestamp: new Date(),
    });

    return relationship;
  }

  async getTrustRelationship(trustId: string): Promise<TrustRelationship | undefined> {
    const trust = this.relationships.get(trustId);
    if (!trust) {
      return undefined;
    }
    return this.reconcileRelationshipState(trust);
  }

  async getTrustsForOrganization(orgId: string): Promise<TrustRelationship[]> {
    const trustIds = this.indexByOrg.get(orgId);
    if (!trustIds) return [];

    return Array.from(trustIds)
      .map((id) => this.relationships.get(id))
      .filter((t): t is TrustRelationship => t !== undefined)
      .map((trust) => this.reconcileRelationshipState(trust));
  }

  async getTrustBetweenOrgs(
    sourceOrgId: string,
    targetOrgId: string,
  ): Promise<TrustRelationship | undefined> {
    const trustIds = this.indexByOrg.get(sourceOrgId);
    if (!trustIds) return undefined;

    for (const id of trustIds) {
      const trust = this.relationships.get(id);
      if (!trust || trust.targetOrgId !== targetOrgId) {
        continue;
      }
      const reconciled = this.reconcileRelationshipState(trust);
      if (reconciled.status === "active") {
        return reconciled;
      }
    }
    return undefined;
  }

  async updateTrustLevel(trustId: string, newLevel: TrustLevel, actor?: string): Promise<void> {
    const trust = this.relationships.get(trustId);
    if (!trust) {
      throw new Error(`Trust relationship not found: ${trustId}`);
    }

    const previousScore = trust.metrics.trustScore;
    const previousLevel = trust.level;
    trust.level = newLevel;
    trust.lastVerifiedAt = new Date();
    trust.status = "active";

    const newPolicy = this.getPolicyForLevel(newLevel);
    if (newPolicy) {
      trust.policy = newPolicy;
    }

    this.recordEvent({
      id: newId("trust_event"),
      trustId,
      type: newLevel > previousLevel ? "trust.elevated" : "trust.degraded",
      timestamp: new Date(),
      ...(previousScore !== undefined ? { previousScore } : {}),
      ...(trust.metrics.trustScore !== undefined ? { newScore: trust.metrics.trustScore } : {}),
      ...(actor !== undefined ? { actor } : {}),
      reason: `Trust level changed from ${previousLevel} to ${newLevel}`,
    });
  }

  async suspendTrust(trustId: string, reason: string, actor?: string): Promise<void> {
    const trust = this.relationships.get(trustId);
    if (!trust) {
      throw new Error(`Trust relationship not found: ${trustId}`);
    }

    trust.status = "suspended";
    const suspendEvent: {
      id: string;
      trustId: string;
      type: "trust.suspended";
      timestamp: Date;
      actor?: string;
      reason: string;
    } = {
      id: newId("trust_event"),
      trustId,
      type: "trust.suspended",
      timestamp: new Date(),
      reason,
    };
    if (actor !== undefined) {
      suspendEvent.actor = actor;
    }
    this.recordEvent(suspendEvent);
  }

  async revokeTrust(trustId: string, reason: string, actor?: string): Promise<void> {
    const trust = this.relationships.get(trustId);
    if (!trust) {
      throw new Error(`Trust relationship not found: ${trustId}`);
    }

    trust.status = "revoked";
    trust.expiresAt = new Date();

    const revokeEvent: {
      id: string;
      trustId: string;
      type: "trust.revoked";
      timestamp: Date;
      actor?: string;
      reason: string;
    } = {
      id: newId("trust_event"),
      trustId,
      type: "trust.revoked",
      timestamp: new Date(),
      reason,
    };
    if (actor !== undefined) {
      revokeEvent.actor = actor;
    }
    this.recordEvent(revokeEvent);
  }

  async renewTrust(trustId: string, newExpiry: Date, actor?: string): Promise<void> {
    const trust = this.relationships.get(trustId);
    if (!trust) {
      throw new Error(`Trust relationship not found: ${trustId}`);
    }

    trust.expiresAt = newExpiry;
    trust.lastVerifiedAt = new Date();
    trust.status = "active";

    const renewEvent: {
      id: string;
      trustId: string;
      type: "trust.renewed";
      timestamp: Date;
      actor?: string;
      reason: string;
    } = {
      id: newId("trust_event"),
      trustId,
      type: "trust.renewed",
      timestamp: new Date(),
      reason: `Trust renewed until ${newExpiry.toISOString()}`,
    };
    if (actor !== undefined) {
      renewEvent.actor = actor;
    }
    this.recordEvent(renewEvent);
  }

  // Trust Evaluation
  async evaluateTrust(trustId: string): Promise<TrustEvaluation> {
    const trust = this.relationships.get(trustId);
    if (!trust) {
      throw new Error(`Trust relationship not found: ${trustId}`);
    }

    const reconciledTrust = this.reconcileRelationshipState(trust);
    const factors = this.calculateTrustFactors(reconciledTrust);
    const trustScore = this.calculateTrustScore(factors);
    const recommendation = this.getRecommendation(trustScore, reconciledTrust);
    const reason = this.getRecommendationReason(trustScore, reconciledTrust, recommendation);

    reconciledTrust.metrics.trustScore = trustScore;
    this.persistSnapshot();

    return {
      trustId,
      orgId: reconciledTrust.sourceOrgId,
      targetOrgId: reconciledTrust.targetOrgId,
      evaluatedAt: new Date(),
      trustScore,
      factors,
      recommendation,
      reason,
    };
  }

  async evaluateTrustBetweenOrgs(
    sourceOrgId: string,
    targetOrgId: string,
  ): Promise<TrustEvaluation | undefined> {
    const trust = await this.getTrustBetweenOrgs(sourceOrgId, targetOrgId);
    if (!trust) return undefined;
    return this.evaluateTrust(trust.id);
  }

  // Metrics
  async updateMetrics(
    trustId: string,
    interaction: {
      success: boolean;
      latencyMs?: number;
    },
  ): Promise<void> {
    const trust = this.relationships.get(trustId);
    if (!trust) {
      throw new Error(`Trust relationship not found: ${trustId}`);
    }

    const reconciledTrust = this.reconcileRelationshipState(trust);
    reconciledTrust.metrics.lastInteraction = new Date();

    if (interaction.success) {
      reconciledTrust.metrics.successfulInteractions++;
    } else {
      reconciledTrust.metrics.failedInteractions++;
    }

    if (interaction.latencyMs !== undefined) {
      const successCount = Math.max(1, reconciledTrust.metrics.successfulInteractions);
      reconciledTrust.metrics.averageLatencyMs =
        ((reconciledTrust.metrics.averageLatencyMs * (successCount - 1)) + interaction.latencyMs) / successCount;
    }

    const total =
      reconciledTrust.metrics.successfulInteractions + reconciledTrust.metrics.failedInteractions;
    reconciledTrust.metrics.uptimePercentage =
      total === 0 ? 100 : (reconciledTrust.metrics.successfulInteractions / total) * 100;

    reconciledTrust.metrics.trustScore = this.calculateTrustScore(this.calculateTrustFactors(reconciledTrust));
    this.persistSnapshot();
  }

  // Trust Events
  getTrustEvents(trustId: string): TrustEvent[] {
    return this.events.filter((e) => e.trustId === trustId);
  }

  getRecentEvents(limit = 100): TrustEvent[] {
    return [...this.events]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Policy Management
  registerPolicy(policy: TrustPolicy): void {
    this.policies.set(policy.id, policy);
    this.persistSnapshot();
  }

  getPolicy(policyId: string): TrustPolicy | undefined {
    return this.policies.get(policyId);
  }

  getPoliciesForLevel(level: TrustLevel): TrustPolicy[] {
    return Array.from(this.policies.values()).filter((p) => p.minTrustLevel === level);
  }

  // Helper Methods
  private createInitialMetrics(): TrustMetrics {
    return {
      successfulInteractions: 0,
      failedInteractions: 0,
      averageLatencyMs: 0,
      uptimePercentage: 100,
      trustScore: 0.5,
    };
  }

  private getDefaultPolicy(level: TrustLevel): TrustPolicy {
    return {
      id: `default-${level}`,
      name: `Default Policy for ${level}`,
      description: `Default trust policy for ${level} trust level`,
      minTrustLevel: level,
      maxDelegationDepth: 3,
      allowedCapabilities: [],
      requiredCapabilities: [],
      requirePeriodicReauth: true,
      reauthIntervalDays: 90,
    };
  }

  private getPolicyForLevel(level: TrustLevel): TrustPolicy | undefined {
    const policies = this.getPoliciesForLevel(level);
    return policies[0] ?? this.getDefaultPolicy(level);
  }

  private calculateTrustFactors(trust: TrustRelationship): TrustFactor[] {
    const factors: TrustFactor[] = [];
    const metrics = trust.metrics;

    const uptimeFactor: TrustFactor = {
      name: "uptime",
      weight: 0.3,
      value: metrics.uptimePercentage / 100,
      contribution: 0,
      description: "Organization uptime percentage",
    };
    uptimeFactor.contribution = uptimeFactor.weight * uptimeFactor.value;
    factors.push(uptimeFactor);

    const totalInteractions = metrics.successfulInteractions + metrics.failedInteractions;
    const successRate = totalInteractions > 0 ? metrics.successfulInteractions / totalInteractions : 1;
    const interactionFactor: TrustFactor = {
      name: "interaction_success",
      weight: 0.25,
      value: successRate,
      contribution: 0,
      description: "Ratio of successful to total interactions",
    };
    interactionFactor.contribution = interactionFactor.weight * interactionFactor.value;
    factors.push(interactionFactor);

    const latencyScore = Math.max(0, 1 - metrics.averageLatencyMs / 5000);
    const latencyFactor: TrustFactor = {
      name: "latency",
      weight: 0.15,
      value: latencyScore,
      contribution: 0,
      description: "Average interaction latency",
    };
    latencyFactor.contribution = latencyFactor.weight * latencyFactor.value;
    factors.push(latencyFactor);

    const daysSinceLastInteraction = metrics.lastInteraction
      ? (Date.now() - metrics.lastInteraction.getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    const recencyScore = Math.max(0, 1 - daysSinceLastInteraction / 30);
    const recencyFactor: TrustFactor = {
      name: "recency",
      weight: 0.15,
      value: recencyScore,
      contribution: 0,
      description: "Days since last interaction",
    };
    recencyFactor.contribution = recencyFactor.weight * recencyFactor.value;
    factors.push(recencyFactor);

    const daysSinceVerification = trust.lastVerifiedAt
      ? (Date.now() - trust.lastVerifiedAt.getTime()) / (1000 * 60 * 60 * 24)
      : Number.POSITIVE_INFINITY;
    const verificationScore = Math.max(0, 1 - daysSinceVerification / Math.max(1, trust.policy.reauthIntervalDays));
    const verificationFactor: TrustFactor = {
      name: "verification",
      weight: 0.15,
      value: verificationScore,
      contribution: 0,
      description: "Trust relationship verification status",
    };
    verificationFactor.contribution = verificationFactor.weight * verificationFactor.value;
    factors.push(verificationFactor);

    return factors;
  }

  private calculateTrustScore(factors: TrustFactor[]): number {
    return factors.reduce((sum, factor) => sum + factor.contribution, 0);
  }

  private getRecommendation(
    score: number,
    trust: TrustRelationship,
  ): "grant" | "review" | "deny" {
    if (trust.status !== "active") {
      return "deny";
    }
    if (score >= 0.7) return "grant";
    if (score >= 0.4) return "review";
    return "deny";
  }

  private getRecommendationReason(
    score: number,
    trust: TrustRelationship,
    recommendation: "grant" | "review" | "deny",
  ): string {
    if (trust.status === "expired") {
      return "Trust relationship expired or exceeded its verification window";
    }
    if (trust.status === "suspended") {
      return "Trust relationship is suspended";
    }
    if (trust.status === "revoked") {
      return "Trust relationship has been revoked";
    }
    switch (recommendation) {
      case "grant":
        return `Trust score ${(score * 100).toFixed(0)}% exceeds threshold for automatic grant`;
      case "review":
        return `Trust score ${(score * 100).toFixed(0)}% requires manual review before decision`;
      case "deny":
        return `Trust score ${(score * 100).toFixed(0)}% below minimum threshold`;
    }
  }

  private indexOrg(trust: TrustRelationship): void {
    for (const orgId of [trust.sourceOrgId, trust.targetOrgId]) {
      if (!this.indexByOrg.has(orgId)) {
        this.indexByOrg.set(orgId, new Set());
      }
      this.indexByOrg.get(orgId)?.add(trust.id);
    }
  }

  private recordEvent(event: TrustEvent): void {
    this.events.push(event);
    this.persistSnapshot();
  }

  private rebuildIndices(): void {
    this.indexByOrg.clear();
    for (const trust of this.relationships.values()) {
      this.indexOrg(trust);
    }
  }

  private reconcileRelationshipState(trust: TrustRelationship): TrustRelationship {
    const nextStatus = this.resolveActiveStatus(trust);
    if (nextStatus !== trust.status) {
      trust.status = nextStatus;
      this.persistSnapshot();
    }
    return trust;
  }

  private resolveActiveStatus(trust: TrustRelationship): TrustStatus {
    if (trust.status === "revoked" || trust.status === "suspended") {
      return trust.status;
    }
    const now = Date.now();
    if (trust.expiresAt != null && trust.expiresAt.getTime() <= now) {
      return "expired";
    }
    if (!trust.policy.requirePeriodicReauth) {
      return trust.status === "expired" ? "active" : trust.status;
    }
    if (trust.lastVerifiedAt == null) {
      return "expired";
    }
    const reauthIntervalMs = Math.max(1, trust.policy.reauthIntervalDays) * 24 * 60 * 60 * 1000;
    if ((trust.lastVerifiedAt.getTime() + reauthIntervalMs) <= now) {
      return "expired";
    }
    return "active";
  }
}

export function createTrustRelationshipManager(
  policies?: TrustPolicy[],
  storageOptions?: TrustRelationshipStorageOptions,
): TrustRelationshipManager {
  return new TrustRelationshipManager(policies, storageOptions);
}
