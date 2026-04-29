/**
 * Config Lifecycle Types
 *
 * Implements §24.1 four config lifecycle types:
 * - admission_locked: Config requires explicit admission control, blocks execution until approved
 * - checkpoint_revalidated: Config has been validated at a checkpoint and can be used
 * - hot_reloadable: Config can be reloaded without restart
 * - emergency_override: Config bypasses normal gates for emergency use
 */

import { nowIso } from "../../contracts/types/ids.js";

/**
 * Configuration lifecycle state type.
 * §24.1: Four lifecycle types for configuration management.
 */
export type ConfigLifecycleState =
  /** Config requires explicit admission control - blocks execution until approved */
  | "admission_locked"
  /** Config has been validated at a checkpoint and can be used */
  | "checkpoint_revalidated"
  /** Config can be reloaded without restart */
  | "hot_reloadable"
  /** Config bypasses normal gates for emergency use */
  | "emergency_override";

/**
 * Config lifecycle transition event.
 */
export interface ConfigLifecycleTransition {
  /** Unique transition ID */
  transitionId: string;
  /** Configuration path */
  configPath: string;
  /** Layer of the config */
  layer: string;
  /** Previous lifecycle state */
  fromState: ConfigLifecycleState | null;
  /** New lifecycle state */
  toState: ConfigLifecycleState;
  /** Actor who triggered the transition */
  triggeredBy: string | null;
  /** Reason for the transition */
  reason: string | null;
  /** When the transition occurred */
  transitionedAt: string;
}

/**
 * Admission-locked config metadata.
 */
export interface AdmissionLockedConfig {
  /** Configuration path */
  configPath: string;
  /** Layer */
  layer: string;
  /** Source ID if applicable */
  sourceId: string | null;
  /** When the config was locked */
  lockedAt: string;
  /** Who locked the config */
  lockedBy: string | null;
  /** Reason for locking */
  reason: string | null;
  /** Admission approval record if approved */
  approvalRecord: ConfigAdmissionApproval | null;
}

/**
 * Config admission approval record.
 */
export interface ConfigAdmissionApproval {
  /** Approval ID */
  approvalId: string;
  /** Configuration path */
  configPath: string;
  /** Who approved */
  approvedBy: string | null;
  /** When approved */
  approvedAt: string;
  /** Approval conditions */
  conditions: string[] | null;
}

/**
 * Checkpoint-revalidated config metadata.
 */
export interface CheckpointRevalidatedConfig {
  /** Configuration path */
  configPath: string;
  /** Layer */
  layer: string;
  /** Source ID if applicable */
  sourceId: string | null;
  /** Checkpoint ID that validated this config */
  checkpointId: string;
  /** When validated */
  validatedAt: string;
  /** Validation result */
  validationResult: "passed" | "warning" | "failed";
  /** Validation details */
  validationDetails: string | null;
}

/**
 * Hot-reloadable config metadata.
 */
export interface HotReloadableConfig {
  /** Configuration path */
  configPath: string;
  /** Layer */
  layer: string;
  /** Source ID if applicable */
  sourceId: string | null;
  /** Whether reload is enabled */
  reloadEnabled: boolean;
  /** Reload strategy */
  reloadStrategy: "immediate" | "graceful" | "scheduled";
  /** Last reload timestamp */
  lastReloadedAt: string | null;
  /** Current config version */
  currentVersion: string | null;
}

/**
 * Emergency override config metadata.
 */
export interface EmergencyOverrideConfig {
  /** Configuration path */
  configPath: string;
  /** Layer */
  layer: string;
  /** Source ID if applicable */
  sourceId: string | null;
  /** When emergency override was activated */
  activatedAt: string;
  /** Who activated */
  activatedBy: string | null;
  /** Original config content before override */
  originalContent: Record<string, unknown> | null;
  /** Override reason */
  reason: string | null;
  /** When the override expires (null = no expiration) */
  expiresAt: string | null;
  /** Whether the override has been acknowledged */
  acknowledged: boolean;
}

/**
 * Configuration lifecycle state record.
 */
export interface ConfigLifecycleRecord {
  /** Configuration path */
  configPath: string;
  /** Layer */
  layer: string;
  /** Source ID if applicable */
  sourceId: string | null;
  /** Current lifecycle state */
  state: ConfigLifecycleState;
  /** State-specific metadata */
  metadata: AdmissionLockedConfig | CheckpointRevalidatedConfig | HotReloadableConfig | EmergencyOverrideConfig;
  /** When the state was last updated */
  updatedAt: string;
  /** State transition history */
  transitionHistory: ConfigLifecycleTransition[];
}

/**
 * Service for managing config lifecycle states.
 * §24.1/R15-75: Implements the four config lifecycle types.
 */
export class ConfigLifecycleManager {
  /** In-memory storage for lifecycle records */
  private readonly records = new Map<string, ConfigLifecycleRecord>();

  /**
   * Creates an admission-locked config.
   * §24.1: Blocks execution until explicitly admitted.
   */
  public createAdmissionLocked(
    configPath: string,
    layer: string,
    sourceId: string | null,
    lockedBy: string | null,
    reason: string | null,
  ): ConfigLifecycleRecord {
    const key = this.buildKey(configPath, layer, sourceId);
    const now = nowIso();

    const metadata: AdmissionLockedConfig = {
      configPath,
      layer,
      sourceId,
      lockedAt: now,
      lockedBy,
      reason,
      approvalRecord: null,
    };

    const record: ConfigLifecycleRecord = {
      configPath,
      layer,
      sourceId,
      state: "admission_locked",
      metadata,
      updatedAt: now,
      transitionHistory: [],
    };

    this.records.set(key, record);
    return record;
  }

  /**
   * Approves an admission-locked config, transitioning it to checkpoint_revalidated.
   * §24.1: Unblocks execution after approval.
   */
  public approveAdmission(
    configPath: string,
    layer: string,
    sourceId: string | null,
    approvedBy: string | null,
    conditions: string[] | null,
  ): ConfigLifecycleRecord | null {
    const key = this.buildKey(configPath, layer, sourceId);
    const record = this.records.get(key);

    if (!record || record.state !== "admission_locked") {
      return null;
    }

    const now = nowIso();
    const approvalRecord: ConfigAdmissionApproval = {
      approvalId: `approval-${Date.now()}`,
      configPath,
      approvedBy,
      approvedAt: now,
      conditions,
    };

    // Transition to checkpoint_revalidated
    const transition: ConfigLifecycleTransition = {
      transitionId: `trans-${Date.now()}`,
      configPath,
      layer,
      fromState: "admission_locked",
      toState: "checkpoint_revalidated",
      triggeredBy: approvedBy,
      reason: "Admission approved",
      transitionedAt: now,
    };

    const metadata: CheckpointRevalidatedConfig = {
      configPath,
      layer,
      sourceId,
      checkpointId: approvalRecord.approvalId,
      validatedAt: now,
      validationResult: "passed",
      validationDetails: conditions ? `Approved with conditions: ${conditions.join(", ")}` : "Approved without conditions",
    };

    const updatedRecord: ConfigLifecycleRecord = {
      ...record,
      state: "checkpoint_revalidated",
      metadata,
      updatedAt: now,
      transitionHistory: [...record.transitionHistory, transition],
    };

    this.records.set(key, updatedRecord);
    return updatedRecord;
  }

  /**
   * Transitions a config to hot_reloadable state.
   * §24.1: Enables reload without restart.
   */
  public enableHotReload(
    configPath: string,
    layer: string,
    sourceId: string | null,
    reloadStrategy: "immediate" | "graceful" | "scheduled" = "graceful",
  ): ConfigLifecycleRecord | null {
    const key = this.buildKey(configPath, layer, sourceId);
    const record = this.records.get(key);
    const now = nowIso();

    if (!record) {
      // Create new hot_reloadable record
      const metadata: HotReloadableConfig = {
        configPath,
        layer,
        sourceId,
        reloadEnabled: true,
        reloadStrategy,
        lastReloadedAt: null,
        currentVersion: null,
      };

      const newRecord: ConfigLifecycleRecord = {
        configPath,
        layer,
        sourceId,
        state: "hot_reloadable",
        metadata,
        updatedAt: now,
        transitionHistory: [{
          transitionId: `trans-${Date.now()}`,
          configPath,
          layer,
          fromState: null,
          toState: "hot_reloadable",
          triggeredBy: null,
          reason: "Hot reload enabled",
          transitionedAt: now,
        }],
      };

      this.records.set(key, newRecord);
      return newRecord;
    }

    // Transition existing record
    const transition: ConfigLifecycleTransition = {
      transitionId: `trans-${Date.now()}`,
      configPath,
      layer,
      fromState: record.state,
      toState: "hot_reloadable",
      triggeredBy: null,
      reason: "Hot reload enabled",
      transitionedAt: now,
    };

    const metadata: HotReloadableConfig = {
      configPath,
      layer,
      sourceId,
      reloadEnabled: true,
      reloadStrategy,
      lastReloadedAt: (record.metadata as HotReloadableConfig).lastReloadedAt ?? null,
      currentVersion: (record.metadata as HotReloadableConfig).currentVersion ?? null,
    };

    const updatedRecord: ConfigLifecycleRecord = {
      ...record,
      state: "hot_reloadable",
      metadata,
      updatedAt: now,
      transitionHistory: [...record.transitionHistory, transition],
    };

    this.records.set(key, updatedRecord);
    return updatedRecord;
  }

  /**
   * Activates emergency override for a config.
   * §24.1: Bypasses normal gates for emergency use.
   */
  public activateEmergencyOverride(
    configPath: string,
    layer: string,
    sourceId: string | null,
    activatedBy: string | null,
    originalContent: Record<string, unknown> | null,
    reason: string | null,
    expiresAt: string | null = null,
  ): ConfigLifecycleRecord {
    const key = this.buildKey(configPath, layer, sourceId);
    const record = this.records.get(key);
    const now = nowIso();

    const metadata: EmergencyOverrideConfig = {
      configPath,
      layer,
      sourceId,
      activatedAt: now,
      activatedBy,
      originalContent,
      reason,
      expiresAt,
      acknowledged: false,
    };

    const newRecord: ConfigLifecycleRecord = {
      configPath,
      layer,
      sourceId,
      state: "emergency_override",
      metadata,
      updatedAt: now,
      transitionHistory: record ? [...record.transitionHistory, {
        transitionId: `trans-${Date.now()}`,
        configPath,
        layer,
        fromState: record.state,
        toState: "emergency_override",
        triggeredBy: activatedBy,
        reason: reason ?? "Emergency override activated",
        transitionedAt: now,
      }] : [{
        transitionId: `trans-${Date.now()}`,
        configPath,
        layer,
        fromState: null,
        toState: "emergency_override",
        triggeredBy: activatedBy,
        reason: reason ?? "Emergency override activated",
        transitionedAt: now,
      }],
    };

    this.records.set(key, newRecord);
    return newRecord;
  }

  /**
   * Deactivates emergency override, returning to previous state or checkpoint_revalidated.
   */
  public deactivateEmergencyOverride(
    configPath: string,
    layer: string,
    sourceId: string | null,
    deactivatedBy: string | null,
  ): ConfigLifecycleRecord | null {
    const key = this.buildKey(configPath, layer, sourceId);
    const record = this.records.get(key);

    if (!record || record.state !== "emergency_override") {
      return null;
    }

    const now = nowIso();
    const metadata = record.metadata as EmergencyOverrideConfig;

    // Transition back to checkpoint_revalidated if we have original content, otherwise admission_locked
    const previousState: ConfigLifecycleState = metadata.originalContent ? "checkpoint_revalidated" : "admission_locked";

    const transition: ConfigLifecycleTransition = {
      transitionId: `trans-${Date.now()}`,
      configPath,
      layer,
      fromState: "emergency_override",
      toState: previousState,
      triggeredBy: deactivatedBy,
      reason: "Emergency override deactivated",
      transitionedAt: now,
    };

    let newMetadata: ConfigLifecycleRecord["metadata"];
    if (previousState === "checkpoint_revalidated") {
      newMetadata = {
        configPath,
        layer,
        sourceId,
        checkpointId: "emergency_restore",
        validatedAt: now,
        validationResult: "warning",
        validationDetails: "Restored from emergency override",
      } as CheckpointRevalidatedConfig;
    } else {
      newMetadata = {
        configPath,
        layer,
        sourceId,
        lockedAt: now,
        lockedBy: deactivatedBy,
        reason: "Re-locked after emergency override",
        approvalRecord: null,
      } as AdmissionLockedConfig;
    }

    const updatedRecord: ConfigLifecycleRecord = {
      ...record,
      state: previousState,
      metadata: newMetadata,
      updatedAt: now,
      transitionHistory: [...record.transitionHistory, transition],
    };

    this.records.set(key, updatedRecord);
    return updatedRecord;
  }

  /**
   * Gets the lifecycle record for a config.
   */
  public getLifecycleRecord(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): ConfigLifecycleRecord | null {
    const key = this.buildKey(configPath, layer, sourceId);
    return this.records.get(key) ?? null;
  }

  /**
   * Checks if a config can be used (is not blocked).
   */
  public canUseConfig(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): { allowed: boolean; reason: string | null } {
    const record = this.getLifecycleRecord(configPath, layer, sourceId);

    if (!record) {
      // No record means no restrictions
      return { allowed: true, reason: null };
    }

    switch (record.state) {
      case "admission_locked":
        return {
          allowed: false,
          reason: "Config is admission-locked and requires approval",
        };
      case "checkpoint_revalidated":
        return { allowed: true, reason: null };
      case "hot_reloadable":
        return { allowed: true, reason: null };
      case "emergency_override":
        // Emergency override is allowed but with warning
        const meta = record.metadata as EmergencyOverrideConfig;
        if (meta.expiresAt && new Date(meta.expiresAt) < new Date()) {
          return {
            allowed: false,
            reason: "Emergency override has expired",
          };
        }
        return {
          allowed: true,
          reason: "Emergency override is active",
        };
      default:
        return { allowed: true, reason: null };
    }
  }

  /**
   * Builds a storage key from config path components.
   */
  private buildKey(configPath: string, layer: string, sourceId: string | null): string {
    return `${layer}:${sourceId ?? "null"}:${configPath}`;
  }
}
