/**
 * Stable Evidence Campaign Orchestrator
 *
 * Runs a long-duration evidence campaign that validates system stability under
 * sustained execution load. This is the top-level orchestrator that alternates
 * between validation segments (quick targeted smoke) and soak segments
 * (sustained execution runs), then bundles the combined results.
 *
 * Campaign phases:
 * 1. Validation segment - runs stable validation for fixed iterations to confirm
 *    basic runtime contracts (startup consistency, storage integrity, etc.)
 * 2. Soak segment - runs stable soak for configurable duration, exercising
 *    concurrent task execution and observing error rates, backup failures, integrity
 * 3. Evidence bundle - after target duration, merges all segment reports into
 *    a StableEvidenceBundleReport serving as the stable-launch evidence artifact
 *
 * The campaign is resumable: if interrupted, it loads prior state and continues
 * from the last completed segment.
 *
 * @see stable-evidence-bundle.ts for the evidence bundle produced at campaign end
 * @see stable-runtime-validator.ts for validation segment logic
 * @see stable-runtime-soak-runner.ts for soak segment logic
 * @see docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md for QA-64
 */
import { type StableEvidenceBundleReport, type StableEvidenceProfile, type StableEvidenceProfileName } from "./stable-evidence-bundle.js";
/** Options for running an evidence campaign */
export interface StableEvidenceCampaignOptions {
    outputDir: string;
    profileName?: StableEvidenceProfileName;
    /** Target duration in milliseconds (uses profile default if not specified) */
    targetDurationMs?: number;
    /** Duration of each segment in milliseconds */
    segmentDurationMs?: number;
    /** Milliseconds between soak cycles */
    intervalMs?: number;
    /** Number of golden task iterations per soak cycle */
    iterationsPerCycle?: number;
    /** Number of validation iterations per segment */
    validationIterations?: number;
    /** Whether to enforce wall-clock duration tracking */
    enforceWallClockDuration?: boolean;
}
/** A single segment within a campaign */
export interface StableEvidenceCampaignSegment {
    segment: number;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    wallClockDurationMs: number;
    validationReportPath: string;
    soakReportPath: string;
    passed: boolean;
}
/** Complete campaign state for resumability */
export interface StableEvidenceCampaignState {
    campaignId: string;
    profile: StableEvidenceProfile;
    /** How duration is tracked: virtual (iteration count) or wall_clock */
    durationMode: "virtual" | "wall_clock";
    targetDurationMs: number;
    accumulatedDurationMs: number;
    remainingDurationMs: number;
    accumulatedWallClockDurationMs: number;
    remainingWallClockDurationMs: number;
    startedAt: string;
    updatedAt: string;
    completed: boolean;
    finalEvidenceReportPath: string | null;
    finalEvidencePassed: boolean | null;
    segments: StableEvidenceCampaignSegment[];
}
/** Complete campaign report */
export interface StableEvidenceCampaignReport {
    state: StableEvidenceCampaignState;
    finalEvidenceReport: StableEvidenceBundleReport | null;
}
/**
 * Runs a complete evidence campaign.
 *
 * Executes validation and soak segments until the target duration is reached,
 * then produces the evidence bundle. Resumes from interrupted state if present.
 */
export declare function runStableEvidenceCampaign(options: StableEvidenceCampaignOptions): Promise<StableEvidenceCampaignReport>;
