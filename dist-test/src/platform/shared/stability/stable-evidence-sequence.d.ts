/**
 * Stable Evidence Sequence Orchestrator
 *
 * Runs multiple evidence campaigns in sequence, where each subsequent campaign
 * only starts after the previous one completes successfully. This allows
 * progressive evidence gathering across multiple profiles (e.g., 24h, 72h).
 *
 * Key behavior:
 * - Campaigns run sequentially in profile order
 * - If a campaign fails (pass !== true), the sequence is blocked
 * - State is persisted at each step for resumability
 * - Each profile maintains its own output directory under the evidence root
 *
 * The sequence:
 * 1. Loads or creates sequence state from disk
 * 2. Finds the first incomplete profile
 * 3. Runs the evidence campaign for that profile
 * 4. Checks if the campaign passed; if not, marks sequence as blocked
 * 5. If passed, advances to the next profile
 * 6. Repeats until all profiles complete or sequence is blocked
 *
 * @see stable-evidence-campaign.ts for individual campaign logic
 * @see stable-evidence-bundle.ts for evidence bundle format
 */
import type { StableEvidenceProfileName } from "./stable-evidence-bundle.js";
import { type StableEvidenceCampaignOptions, type StableEvidenceCampaignReport } from "./stable-evidence-campaign.js";
/** Profile options for a sequence run (excludes outputDir and profileName inherited from sequence) */
export type StableEvidenceSequenceProfileOptions = Omit<StableEvidenceCampaignOptions, "outputDir" | "profileName">;
/** Options for running an evidence sequence */
export interface StableEvidenceSequenceOptions {
    evidenceRootDir: string;
    /** Profile names to run in sequence (default: ["24h", "72h"]) */
    profileNames?: StableEvidenceProfileName[];
    /** Per-profile option overrides */
    profileOptions?: Partial<Record<StableEvidenceProfileName, StableEvidenceSequenceProfileOptions>>;
}
/** State for a single profile within a sequence */
export interface StableEvidenceSequenceProfileState {
    profileName: StableEvidenceProfileName;
    outputDir: string;
    campaignStatePath: string;
    finalEvidenceReportPath: string;
    startedAt: string | null;
    updatedAt: string | null;
    completed: boolean;
    passed: boolean | null;
    accumulatedDurationMs: number;
    remainingDurationMs: number;
    accumulatedWallClockDurationMs: number;
    remainingWallClockDurationMs: number;
    segmentCount: number;
}
/** Complete sequence state */
export interface StableEvidenceSequenceState {
    sequenceId: string;
    evidenceRootDir: string;
    profileNames: StableEvidenceProfileName[];
    activeProfileName: StableEvidenceProfileName | null;
    completed: boolean;
    blocked: boolean;
    blockReason: string | null;
    startedAt: string;
    updatedAt: string;
    profiles: StableEvidenceSequenceProfileState[];
}
/** Report produced by a sequence run */
export interface StableEvidenceSequenceReport {
    state: StableEvidenceSequenceState;
    advancedProfiles: StableEvidenceProfileName[];
    lastCampaignReport: StableEvidenceCampaignReport | null;
}
/** Options for running sequence until complete (with polling) */
export interface StableEvidenceSequenceUntilCompleteOptions extends StableEvidenceSequenceOptions {
    sleepMs?: number;
    maxPasses?: number;
}
/**
 * Runs a stable evidence sequence.
 *
 * Executes campaigns sequentially, stopping if any campaign fails.
 * Persists state after each step for resumability.
 */
export declare function runStableEvidenceSequence(options: StableEvidenceSequenceOptions): Promise<StableEvidenceSequenceReport>;
/**
 * Runs the evidence sequence with polling until complete or blocked.
 *
 * Useful for running in environments where the process may be restarted
 * before the sequence completes.
 */
export declare function runStableEvidenceSequenceUntilComplete(options: StableEvidenceSequenceUntilCompleteOptions): Promise<StableEvidenceSequenceReport>;
