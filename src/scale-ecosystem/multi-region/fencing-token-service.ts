/**
 * @fileoverview FencingTokenService - Multi-region single-leader enforcement
 *
 * Implements §52.3: Fencing token service for multi-region single-leader enforcement.
 * All truth/budget/side-effect writes must go through leadership validation.
 *
 * Key behaviors:
 * - acquireLeadership(regionId): Acquires leadership for a region with fencing token
 * - releaseLeadership(regionId): Releases leadership and invalidates fencing token
 * - validateFencingToken(entityId, token): Validates token before allowing writes
 */

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { ValidationError } from "../../platform/contracts/errors.js";

/**
 * Fencing token for single-leader enforcement across regions.
 */
export interface FencingToken {
  readonly tokenId: string;
  readonly regionId: string;
  readonly epoch: number;
  readonly issuedAt: string;
  readonly entityId: string | null;
}

/**
 * Leadership state for a region.
 */
export interface LeadershipState {
  readonly regionId: string;
  readonly epoch: number;
  readonly acquiredAt: string;
  readonly fencingToken: FencingToken;
  readonly isActive: boolean;
}

/**
 * Fencing token validation result.
 */
export interface FencingTokenValidationResult {
  readonly valid: boolean;
  readonly reason: string | null;
  readonly currentEpoch: number;
  readonly tokenEpoch: number;
}

interface FencingTokenPersistenceSnapshot {
  readonly epochCounter: number;
  readonly entityLeadership: Record<string, LeadershipState>;
}

export interface FencingTokenServiceOptions {
  readonly storagePath?: string | null;
}

/**
 * Service for managing fencing tokens across multi-region deployments.
 * Ensures only one region can hold leadership for an entity at a time.
 */
export class FencingTokenService {
  private readonly leaderships = new Map<string, LeadershipState>();
  private readonly entityLeadership = new Map<string, LeadershipState>();
  private readonly storagePath: string | null;
  private epochCounter = 0;

  public constructor(options: FencingTokenServiceOptions = {}) {
    this.storagePath = resolveFencingTokenStoragePath(options.storagePath);
    this.loadPersistedState();
  }

  /**
   * §52.3: Acquire leadership for a region.
   * Generates a fencing token that must be presented for all truth/budget/side-effect writes.
   *
   * @param regionId - Region seeking leadership
   * @param entityId - Optional entity ID for entity-level leadership (null for global)
   * @returns Fencing token if leadership acquired, null if leadership already held by another region
   */
  public acquireLeadership(regionId: string, entityId: string | null = null): FencingToken | null {
    const key = entityId ?? "GLOBAL";

    // Check if there's existing leadership
    const existing = this.entityLeadership.get(key);
    if (existing && existing.isActive && existing.regionId !== regionId) {
      // Leadership already held by another region
      return null;
    }

    // Increment epoch for new leadership
    this.epochCounter++;
    const issuedAt = nowIso();

    const fencingToken: FencingToken = {
      tokenId: newId("fence"),
      regionId,
      epoch: this.epochCounter,
      issuedAt,
      entityId,
    };

    const leadershipState: LeadershipState = {
      regionId,
      epoch: this.epochCounter,
      acquiredAt: issuedAt,
      fencingToken,
      isActive: true,
    };

    this.entityLeadership.set(key, leadershipState);
    this.leaderships.set(regionId, leadershipState);
    this.persistState();

    return fencingToken;
  }

  /**
   * §52.3: Release leadership for a region.
   * Invalidates the fencing token and clears leadership state.
   *
   * @param regionId - Region releasing leadership
   * @param entityId - Optional entity ID (null for global)
   * @returns true if leadership was released, false if region didn't hold leadership
   */
  public releaseLeadership(regionId: string, entityId: string | null = null): boolean {
    const key = entityId ?? "GLOBAL";

    const existing = this.entityLeadership.get(key);
    if (!existing || !existing.isActive || existing.regionId !== regionId) {
      return false;
    }

    // Mark leadership as inactive
    const released: LeadershipState = {
      ...existing,
      isActive: false,
    };

    this.entityLeadership.set(key, released);
    this.leaderships.set(regionId, released);
    this.persistState();

    return true;
  }

  /**
   * §52.3: Validate a fencing token for an entity.
   * All truth/budget/side-effect writes must call this before proceeding.
   *
   * @param entityId - Entity ID to validate (null for global)
   * @param token - Fencing token to validate
   * @returns Validation result indicating if the token is valid for writes
   */
  public validateFencingToken(entityId: string | null, token: FencingToken): FencingTokenValidationResult {
    const key = entityId ?? "GLOBAL";
    const current = this.entityLeadership.get(key);

    // No leadership established
    if (!current) {
      return {
        valid: false,
        reason: "no_leadership_established",
        currentEpoch: this.epochCounter,
        tokenEpoch: token.epoch,
      };
    }

    // Leadership is not active
    if (!current.isActive) {
      return {
        valid: false,
        reason: "leadership_released",
        currentEpoch: current.epoch,
        tokenEpoch: token.epoch,
      };
    }

    // Token region doesn't match current leader
    if (current.regionId !== token.regionId) {
      return {
        valid: false,
        reason: "token_region_mismatch",
        currentEpoch: current.epoch,
        tokenEpoch: token.epoch,
      };
    }

    // Token epoch doesn't match current epoch (stale token)
    if (current.epoch !== token.epoch) {
      return {
        valid: false,
        reason: "stale_token_epoch",
        currentEpoch: current.epoch,
        tokenEpoch: token.epoch,
      };
    }

    // Token entity doesn't match
    if (current.fencingToken.entityId !== token.entityId) {
      return {
        valid: false,
        reason: "token_entity_mismatch",
        currentEpoch: current.epoch,
        tokenEpoch: token.epoch,
      };
    }

    return {
      valid: true,
      reason: null,
      currentEpoch: current.epoch,
      tokenEpoch: token.epoch,
    };
  }

  /**
   * Get current leadership state for an entity.
   * @param entityId - Entity ID (null for global)
   * @returns Leadership state or null if not leader
   */
  public getLeadership(entityId: string | null): LeadershipState | null {
    const key = entityId ?? "GLOBAL";
    return this.entityLeadership.get(key) ?? null;
  }

  /**
   * Check if a region is the current leader for an entity.
   * @param regionId - Region to check
   * @param entityId - Entity ID (null for global)
   * @returns true if the region is the current leader
   */
  public isLeader(regionId: string, entityId: string | null = null): boolean {
    const leadership = this.getLeadership(entityId);
    return leadership != null && leadership.isActive && leadership.regionId === regionId;
  }

  /**
   * Get all active leadership states.
   * @returns Array of all active leadership states
   */
  public getAllActiveLeaderships(): readonly LeadershipState[] {
    return [...this.entityLeadership.values()].filter((s) => s.isActive);
  }

  /**
   * Get the current epoch counter.
   * @returns Current epoch number
   */
  public getCurrentEpoch(): number {
    return this.epochCounter;
  }

  private loadPersistedState(): void {
    if (this.storagePath == null) {
      return;
    }
    try {
      const raw = readFileSync(this.storagePath, "utf8").trim();
      if (raw.length === 0) {
        return;
      }
      const snapshot = JSON.parse(raw) as Partial<FencingTokenPersistenceSnapshot>;
      this.epochCounter = typeof snapshot.epochCounter === "number" && Number.isFinite(snapshot.epochCounter)
        ? Math.max(0, Math.trunc(snapshot.epochCounter))
        : 0;
      const persistedLeadership = snapshot.entityLeadership ?? {};
      for (const [key, state] of Object.entries(persistedLeadership)) {
        if (!isLeadershipState(state)) {
          continue;
        }
        this.entityLeadership.set(key, state);
        this.leaderships.set(state.regionId, state);
      }
    } catch {
      this.epochCounter = 0;
      this.entityLeadership.clear();
      this.leaderships.clear();
    }
  }

  private persistState(): void {
    if (this.storagePath == null) {
      return;
    }
    mkdirSync(dirname(this.storagePath), { recursive: true });
    const snapshot: FencingTokenPersistenceSnapshot = {
      epochCounter: this.epochCounter,
      entityLeadership: Object.fromEntries(this.entityLeadership.entries()),
    };
    const tempPath = `${this.storagePath}.${Date.now()}.${randomUUID()}.tmp`;
    let renamed = false;
    try {
      writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), "utf8");
      renameSync(tempPath, this.storagePath);
      renamed = true;
    } finally {
      if (!renamed) {
        try {
          rmSync(tempPath, { force: true });
        } catch {
          // Best-effort cleanup for failed persistence.
        }
      }
    }
  }
}

// Singleton instance for global access
let GLOBAL_FENCING_TOKEN_SERVICE: FencingTokenService | null = null;

export function getFencingTokenService(): FencingTokenService {
  if (!GLOBAL_FENCING_TOKEN_SERVICE) {
    GLOBAL_FENCING_TOKEN_SERVICE = new FencingTokenService();
  }
  return GLOBAL_FENCING_TOKEN_SERVICE;
}

export function resetFencingTokenService(): void {
  GLOBAL_FENCING_TOKEN_SERVICE = null;
}

function resolveFencingTokenStoragePath(explicitPath: string | null | undefined): string | null {
  if (typeof explicitPath === "string") {
    const trimmed = explicitPath.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  const envPath = process.env.AA_FENCING_TOKEN_STATE_PATH?.trim();
  if (envPath != null && envPath.length > 0) {
    return envPath;
  }
  if (process.env.NODE_TEST_CONTEXT === "child-v8") {
    return null;
  }
  return join(process.cwd(), "data", "multi-region", "fencing-token-state.json");
}

function isLeadershipState(value: unknown): value is LeadershipState {
  if (typeof value !== "object" || value == null) {
    return false;
  }
  const candidate = value as Partial<LeadershipState>;
  return typeof candidate.regionId === "string"
    && typeof candidate.epoch === "number"
    && typeof candidate.acquiredAt === "string"
    && typeof candidate.isActive === "boolean"
    && isFencingToken(candidate.fencingToken);
}

function isFencingToken(value: unknown): value is FencingToken {
  if (typeof value !== "object" || value == null) {
    return false;
  }
  const candidate = value as Partial<FencingToken>;
  return typeof candidate.tokenId === "string"
    && typeof candidate.regionId === "string"
    && typeof candidate.epoch === "number"
    && typeof candidate.issuedAt === "string"
    && (candidate.entityId == null || typeof candidate.entityId === "string");
}
