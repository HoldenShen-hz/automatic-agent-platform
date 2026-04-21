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
import { isValidLifecycleTransition, isExecutableStage, isTerminalStage, } from "./business-pack-manifest.js";
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
    packStates = new Map();
    /**
     * Creates a new pack in "draft" state.
     */
    createPack(options) {
        const { manifest } = options;
        if (this.packStates.has(manifest.packId)) {
            throw this.validationError("pack_lifecycle.already_exists", `Pack ${manifest.packId} already exists.`);
        }
        const now = nowIso();
        const state = {
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
    submitForCertification(packId) {
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
    certifyPack(packId, certResult) {
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
            const updatedState = this.packStates.get(packId);
            updatedState.certificationResult = certResult;
            updatedState.stage = "published";
            updatedState.certifiedAt = certResult.certifiedAt;
            updatedState.updatedAt = nowIso();
            return {
                success: true,
                fromStage: "certifying",
                toStage: "published",
            };
        }
        else {
            // Certification failed - transition back to draft
            const updatedState = this.packStates.get(packId);
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
     * Deprecates a published or approved pack.
     * Transitions from "published" or "published" to "deprecated".
     */
    deprecatePack(packId, reason) {
        const state = this.requireState(packId);
        if (!isValidLifecycleTransition(state.stage, "deprecated")) {
            return this.rejectTransition(state.stage, "deprecated");
        }
        const updatedState = this.packStates.get(packId);
        updatedState.stage = "deprecated";
        updatedState.deprecatedAt = nowIso();
        updatedState.deprecationReason = reason;
        updatedState.updatedAt = nowIso();
        return {
            success: true,
            fromStage: state.stage,
            toStage: "deprecated",
        };
    }
    /**
     * Archives a pack.
     * Transitions from any non-terminal state to "archived".
     * Archived is a terminal state.
     */
    archivePack(packId) {
        const state = this.requireState(packId);
        if (!isValidLifecycleTransition(state.stage, "archived")) {
            return this.rejectTransition(state.stage, "archived");
        }
        const updatedState = this.packStates.get(packId);
        updatedState.stage = "archived";
        updatedState.archivedAt = nowIso();
        updatedState.updatedAt = nowIso();
        return {
            success: true,
            fromStage: state.stage,
            toStage: "archived",
        };
    }
    /**
     * Reactivates a deprecated pack back to published.
     * Only allowed from "deprecated" state.
     */
    reactivatePack(packId) {
        const state = this.requireState(packId);
        if (!isValidLifecycleTransition(state.stage, "published")) {
            return this.rejectTransition(state.stage, "published");
        }
        const updatedState = this.packStates.get(packId);
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
    getPackState(packId) {
        return this.packStates.get(packId) ?? null;
    }
    /**
     * Checks if a pack is in an executable stage.
     */
    isPackExecutable(packId) {
        const state = this.packStates.get(packId);
        if (!state) {
            return false;
        }
        return isExecutableStage(state.stage);
    }
    /**
     * Checks if a pack is in a terminal stage.
     */
    isPackArchived(packId) {
        const state = this.packStates.get(packId);
        if (!state) {
            return false;
        }
        return isTerminalStage(state.stage);
    }
    /**
     * Lists all packs in a specific lifecycle stage.
     */
    listPacksByStage(stage) {
        const result = [];
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
    listAll() {
        return [...this.packStates.values()];
    }
    transitionTo(packId, targetStage) {
        const state = this.requireState(packId);
        const updatedState = this.packStates.get(packId);
        updatedState.stage = targetStage;
        updatedState.updatedAt = nowIso();
        return {
            success: true,
            fromStage: state.stage,
            toStage: targetStage,
        };
    }
    requireState(packId) {
        const state = this.packStates.get(packId);
        if (!state) {
            throw this.validationError("pack_lifecycle.not_found", `Pack ${packId} not found.`);
        }
        return state;
    }
    rejectTransition(from, to) {
        return {
            success: false,
            fromStage: from,
            toStage: to,
            reason: `Invalid transition from ${from} to ${to}`,
        };
    }
    validationError(code, message) {
        return new ValidationError(code, message, {
            category: "validation",
            source: "internal",
        });
    }
}
//# sourceMappingURL=pack-lifecycle-service.js.map