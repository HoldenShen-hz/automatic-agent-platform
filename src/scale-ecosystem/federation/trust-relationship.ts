/**
 * Trust Relationship
 * Trust model between organizations
 */

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

/**
 * TrustRelationshipManager manages trust relationships between organizations.
 * It handles trust establishment, evaluation, monitoring, and revocation.
 */
export class TrustRelationshipManager {
  private readonly relationships: Map<string, TrustRelationship> = new Map();
  private readonly policies: Map<string, TrustPolicy> = new Map();
  private readonly events: TrustEvent[] = [];
  private readonly indexByOrg: Map<string, Set<string>> = new Map();

  constructor(policies: TrustPolicy[] = []) {
    for (const policy of policies) {
      this.policies.set(policy.id, policy);
    }
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
      capabilities: params.capabilities,
      metrics: this.createInitialMetrics(),
      policy,
      createdAt: new Date(),
      ...(params.expiresAt !== undefined && { expiresAt: params.expiresAt }),
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
    return this.relationships.get(trustId);
  }

  async getTrustsForOrganization(orgId: string): Promise<TrustRelationship[]> {
    const trustIds = this.indexByOrg.get(orgId);
    if (!trustIds) return [];

    return Array.from(trustIds)
      .map((id) => this.relationships.get(id))
      .filter((t): t is TrustRelationship => t !== undefined);
  }

  async getTrustBetweenOrgs(
    sourceOrgId: string,
    targetOrgId: string
  ): Promise<TrustRelationship | undefined> {
    const trustIds = this.indexByOrg.get(sourceOrgId);
    if (!trustIds) return undefined;

    for (const id of trustIds) {
      const trust = this.relationships.get(id);
      if (trust?.targetOrgId === targetOrgId && trust.status === "active") {
        return trust;
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

    // Update policy if level changed
    const newPolicy = this.getPolicyForLevel(newLevel);
    if (newPolicy) {
      trust.policy = newPolicy;
    }

    this.recordEvent({
      id: newId("trust_event"),
      trustId,
      type: newLevel > previousLevel ? "trust.elevated" : "trust.degraded",
      timestamp: new Date(),
      ...(previousScore !== undefined && { previousScore }),
      ...(trust.metrics.trustScore !== undefined && { newScore: trust.metrics.trustScore }),
      ...(actor !== undefined && { actor }),
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
    trust.expiresAt = new Date(); // Expire immediately

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

    const factors = this.calculateTrustFactors(trust);
    const trustScore = this.calculateTrustScore(factors);
    const recommendation = this.getRecommendation(trustScore, trust);
    const reason = this.getRecommendationReason(trustScore, trust, recommendation);

    // Update metrics with new score
    trust.metrics.trustScore = trustScore;

    return {
      trustId,
      orgId: trust.sourceOrgId,
      targetOrgId: trust.targetOrgId,
      evaluatedAt: new Date(),
      trustScore,
      factors,
      recommendation,
      reason,
    };
  }

  async evaluateTrustBetweenOrgs(
    sourceOrgId: string,
    targetOrgId: string
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
    }
  ): Promise<void> {
    const trust = this.relationships.get(trustId);
    if (!trust) {
      throw new Error(`Trust relationship not found: ${trustId}`);
    }

    trust.metrics.lastInteraction = new Date();

    if (interaction.success) {
      trust.metrics.successfulInteractions++;
    } else {
      trust.metrics.failedInteractions++;
    }

    if (interaction.latencyMs !== undefined) {
      // Running average
      trust.metrics.averageLatencyMs =
        (trust.metrics.averageLatencyMs * (trust.metrics.successfulInteractions - 1) +
          interaction.latencyMs) /
        trust.metrics.successfulInteractions;
    }

    // Recalculate uptime
    const total =
      trust.metrics.successfulInteractions + trust.metrics.failedInteractions;
    trust.metrics.uptimePercentage =
      (trust.metrics.successfulInteractions / total) * 100;

    // Update trust score based on metrics
    trust.metrics.trustScore = this.calculateTrustScore(this.calculateTrustFactors(trust));
  }

  // Trust Events
  getTrustEvents(trustId: string): TrustEvent[] {
    return this.events.filter((e) => e.trustId === trustId);
  }

  getRecentEvents(limit = 100): TrustEvent[] {
    return this.events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Policy Management
  registerPolicy(policy: TrustPolicy): void {
    this.policies.set(policy.id, policy);
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
      trustScore: 0.5, // Start at 50% on first creation
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

    // Uptime factor (30% weight)
    const uptimeFactor: TrustFactor = {
      name: "uptime",
      weight: 0.3,
      value: metrics.uptimePercentage / 100,
      contribution: 0,
      description: "Organization uptime percentage",
    };
    uptimeFactor.contribution = uptimeFactor.weight * uptimeFactor.value;
    factors.push(uptimeFactor);

    // Interaction success factor (25% weight)
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

    // Latency factor (15% weight) - lower is better
    const latencyScore = Math.max(0, 1 - metrics.averageLatencyMs / 5000); // 5s = 0 score
    const latencyFactor: TrustFactor = {
      name: "latency",
      weight: 0.15,
      value: latencyScore,
      contribution: 0,
      description: "Average interaction latency",
    };
    latencyFactor.contribution = latencyFactor.weight * latencyFactor.value;
    factors.push(latencyFactor);

    // Recency factor (15% weight)
    const daysSinceLastInteraction = metrics.lastInteraction
      ? (Date.now() - metrics.lastInteraction.getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    const recencyScore = Math.max(0, 1 - daysSinceLastInteraction / 30); // 30 days = 0 score
    const recencyFactor: TrustFactor = {
      name: "recency",
      weight: 0.15,
      value: recencyScore,
      contribution: 0,
      description: "Days since last interaction",
    };
    recencyFactor.contribution = recencyFactor.weight * recencyFactor.value;
    factors.push(recencyFactor);

    // Verification factor (15% weight)
    const daysSinceVerification = trust.lastVerifiedAt
      ? (Date.now() - trust.lastVerifiedAt.getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    const verificationScore = Math.max(0, 1 - daysSinceVerification / trust.policy.reauthIntervalDays);
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
    trust: TrustRelationship
  ): "grant" | "review" | "deny" {
    if (score >= 0.7) return "grant";
    if (score >= 0.4) return "review";
    return "deny";
  }

  private getRecommendationReason(
    score: number,
    trust: TrustRelationship,
    recommendation: "grant" | "review" | "deny"
  ): string {
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
  }
}

export function createTrustRelationshipManager(policies?: TrustPolicy[]): TrustRelationshipManager {
  return new TrustRelationshipManager(policies);
}
