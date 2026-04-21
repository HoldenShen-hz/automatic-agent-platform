/**
 * @fileoverview Pack Lifecycle Service - Business Pack lifecycle state machine
 *
 * Implements the Business Pack lifecycle as defined in architecture doc §30:
 * - States: draft → certifying → published → deprecated → archived
 * - Pack drives its own risk control and prompt strategy
 * - Certification gate before publishing
 *
 * @see docs_zh/architecture/00-platform-architecture.md §30
 */

import { ValidationError } from "../../platform/contracts/errors.js";
import { nowIso } from "../../platform/contracts/types/ids.js";
import {
  type BusinessPackLifecycleStage,
  type BusinessPackManifest,
  isValidLifecycleTransition,
  isExecutableStage,
  isTerminalStage,
} from "./business-pack-manifest.js";

// ============================================================================
// Lifecycle State
// ============================================================================

/**
 * Pack lifecycle state including stage and metadata.
 */
export interface PackLifecycleState {
  packId: string;
  stage: BusinessPackLifecycleStage;
  createdAt: string;
  updatedAt: string;
  certifiedAt: string | null;
  deprecatedAt: string | null;
  archivedAt: string | null;
  certificationResult: CertificationResult | null;
  deprecationReason: string | null;
}

/**
 * Result of pack certification.
 */
export interface CertificationResult {
  success: boolean;
  certifiedAt: string;
  certifierId: string;
  failureReasons: string[];
}

/**
 * Options for creating a new pack.
 */
export interface CreatePackOptions {
  manifest: BusinessPackManifest;
}

/**
 * Result of a lifecycle transition.
 */
export interface LifecycleTransitionResult {
  success: boolean;
  fromStage: BusinessPackLifecycleStage;
  toStage: BusinessPackLifecycleStage;
  reason?: string;
}

// ============================================================================
// Lifecycle Service
// ============================================================================

/**
 * Pack Lifecycle Service
 *
 * Manages the lifecycle state machine for Business Packs:
 * - draft → certifying → published → deprecated → archived
 *
 * The pack must be certified before it can be published.
 * Once archived, a pack cannot transition to any other state.
 */
export class PackLifecycleService {
  private readonly packStates = new Map<string, PackLifecycleState>();

  /**
   * Creates a new pack in "draft" state.
   */
  public createPack(options: CreatePackOptions): PackLifecycleState {
    const { manifest } = options;

    if (this.packStates.has(manifest.packId)) {
      throw this.validationError(
        "pack_lifecycle.already_exists",
        `Pack ${manifest.packId} already exists.`,
      );
    }

    const now = nowIso();
    const state: PackLifecycleState = {
      packId: manifest.packId,
      stage: "draft",
      createdAt: now,
      updatedAt: now,
      certifiedAt: null,
      deprecatedAt: null,
      archivedAt: null,
      certificationResult: null,
      deprecationReason: null,
    };

    this.packStates.set(manifest.packId, state);
    return state;
  }

  /**
   * Submits a pack for certification.
   * Transitions from "draft" to "certifying".
   */
  public submitForCertification(packId: string): LifecycleTransitionResult {
    const state = this.requireState(packId);

    if (!isValidLifecycleTransition(state.stage, "certifying")) {
      return this.rejectTransition(state.stage, "certifying");
    }

    return this.transitionTo(packId, "certifying");
  }

  /**
   * Certifies or rejects a pack.
   * Transitions from "certifying" to "published" or back to "draft".
   */
  public certifyPack(
    packId: string,
    certResult: CertificationResult,
  ): LifecycleTransitionResult {
    const state = this.requireState(packId);

    if (state.stage !== "certifying") {
      return {
        success: false,
        fromStage: state.stage,
        toStage: state.stage,
        reason: `Pack must be in certifying stage, currently ${state.stage}`,
      };
    }

    if (certResult.success) {
      const updatedState = this.packStates.get(packId)!;
      updatedState.certificationResult = certResult;
      updatedState.stage = "published";
      updatedState.certifiedAt = certResult.certifiedAt;
      updatedState.updatedAt = nowIso();
      return {
        success: true,
        fromStage: "certifying",
        toStage: "published",
      };
    } else {
      // Certification failed - transition back to draft
      const updatedState = this.packStates.get(packId)!;
      updatedState.certificationResult = certResult;
      updatedState.stage = "draft";
      updatedState.updatedAt = nowIso();
      return {
        success: true,
        fromStage: "certifying",
        toStage: "draft",
        reason: `Certification failed: ${certResult.failureReasons.join(", ")}`,
      };
    }
  }

  /**
   * Deprecates a published pack.
   * Transitions from "published" to "deprecated".
   */
  public deprecatePack(packId: string, reason: string): LifecycleTransitionResult {
    const state = this.requireState(packId);
    const fromStage = state.stage;

    if (!isValidLifecycleTransition(state.stage, "deprecated")) {
      return this.rejectTransition(state.stage, "deprecated");
    }

    const updatedState = this.packStates.get(packId)!;
    updatedState.stage = "deprecated";
    updatedState.deprecatedAt = nowIso();
    updatedState.deprecationReason = reason;
    updatedState.updatedAt = nowIso();

    return {
      success: true,
      fromStage,
      toStage: "deprecated",
    };
  }

  /**
   * Archives a pack.
   * Transitions from any non-terminal state to "archived".
   * Archived is a terminal state.
   */
  public archivePack(packId: string): LifecycleTransitionResult {
    const state = this.requireState(packId);
    const fromStage = state.stage;

    if (!isValidLifecycleTransition(state.stage, "archived")) {
      return this.rejectTransition(state.stage, "archived");
    }

    const updatedState = this.packStates.get(packId)!;
    updatedState.stage = "archived";
    updatedState.archivedAt = nowIso();
    updatedState.updatedAt = nowIso();

    return {
      success: true,
      fromStage,
      toStage: "archived",
    };
  }

  /**
   * Reactivates a deprecated pack back to published.
   * Only allowed from "deprecated" state.
   */
  public reactivatePack(packId: string): LifecycleTransitionResult {
    const state = this.requireState(packId);

    if (!isValidLifecycleTransition(state.stage, "published")) {
      return this.rejectTransition(state.stage, "published");
    }

    const updatedState = this.packStates.get(packId)!;
    updatedState.stage = "published";
    updatedState.deprecatedAt = null;
    updatedState.deprecationReason = null;
    updatedState.updatedAt = nowIso();

    return {
      success: true,
      fromStage: "deprecated",
      toStage: "published",
    };
  }

  /**
   * Gets the current lifecycle state of a pack.
   */
  public getPackState(packId: string): PackLifecycleState | null {
    return this.packStates.get(packId) ?? null;
  }

  /**
   * Checks if a pack is in an executable stage.
   */
  public isPackExecutable(packId: string): boolean {
    const state = this.packStates.get(packId);
    if (!state) {
      return false;
    }
    return isExecutableStage(state.stage);
  }

  /**
   * Checks if a pack is in a terminal stage.
   */
  public isPackArchived(packId: string): boolean {
    const state = this.packStates.get(packId);
    if (!state) {
      return false;
    }
    return isTerminalStage(state.stage);
  }

  /**
   * Lists all packs in a specific lifecycle stage.
   */
  public listPacksByStage(stage: BusinessPackLifecycleStage): PackLifecycleState[] {
    const result: PackLifecycleState[] = [];
    for (const state of this.packStates.values()) {
      if (state.stage === stage) {
        result.push(state);
      }
    }
    return result;
  }

  /**
   * Lists all pack lifecycle states.
   */
  public listAll(): PackLifecycleState[] {
    return [...this.packStates.values()];
  }

  private transitionTo(packId: string, targetStage: BusinessPackLifecycleStage): LifecycleTransitionResult {
    const state = this.requireState(packId);
    const fromStage = state.stage;
    const updatedState = this.packStates.get(packId)!;
    updatedState.stage = targetStage;
    updatedState.updatedAt = nowIso();
    return {
      success: true,
      fromStage,
      toStage: targetStage,
    };
  }

  private requireState(packId: string): PackLifecycleState {
    const state = this.packStates.get(packId);
    if (!state) {
      throw this.validationError("pack_lifecycle.not_found", `Pack ${packId} not found.`);
    }
    return state;
  }

  private rejectTransition(
    from: BusinessPackLifecycleStage,
    to: BusinessPackLifecycleStage,
  ): LifecycleTransitionResult {
    return {
      success: false,
      fromStage: from,
      toStage: to,
      reason: `Invalid transition from ${from} to ${to}`,
    };
  }

  private validationError(code: string, message: string): ValidationError {
    return new ValidationError(code, message, {
      category: "validation",
      source: "internal",
    });
  }
}
