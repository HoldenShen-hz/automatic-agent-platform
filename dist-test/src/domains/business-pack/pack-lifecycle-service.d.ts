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
import { type BusinessPackLifecycleStage, type BusinessPackManifest } from "./business-pack-manifest.js";
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
/**
 * Pack Lifecycle Service
 *
 * Manages the lifecycle state machine for Business Packs:
 * - draft → certifying → published → deprecated → archived
 *
 * The pack must be certified before it can be published.
 * Once archived, a pack cannot transition to any other state.
 */
export declare class PackLifecycleService {
    private readonly packStates;
    /**
     * Creates a new pack in "draft" state.
     */
    createPack(options: CreatePackOptions): PackLifecycleState;
    /**
     * Submits a pack for certification.
     * Transitions from "draft" to "certifying".
     */
    submitForCertification(packId: string): LifecycleTransitionResult;
    /**
     * Certifies or rejects a pack.
     * Transitions from "certifying" to "published" or back to "draft".
     */
    certifyPack(packId: string, certResult: CertificationResult): LifecycleTransitionResult;
    /**
     * Deprecates a published pack.
     * Transitions from "published" to "deprecated".
     */
    deprecatePack(packId: string, reason: string): LifecycleTransitionResult;
    /**
     * Archives a pack.
     * Transitions from any non-terminal state to "archived".
     * Archived is a terminal state.
     */
    archivePack(packId: string): LifecycleTransitionResult;
    /**
     * Reactivates a deprecated pack back to published.
     * Only allowed from "deprecated" state.
     */
    reactivatePack(packId: string): LifecycleTransitionResult;
    /**
     * Gets the current lifecycle state of a pack.
     */
    getPackState(packId: string): PackLifecycleState | null;
    /**
     * Checks if a pack is in an executable stage.
     */
    isPackExecutable(packId: string): boolean;
    /**
     * Checks if a pack is in a terminal stage.
     */
    isPackArchived(packId: string): boolean;
    /**
     * Lists all packs in a specific lifecycle stage.
     */
    listPacksByStage(stage: BusinessPackLifecycleStage): PackLifecycleState[];
    /**
     * Lists all pack lifecycle states.
     */
    listAll(): PackLifecycleState[];
    private transitionTo;
    private requireState;
    private rejectTransition;
    private validationError;
}
