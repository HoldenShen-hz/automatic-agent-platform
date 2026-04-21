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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runStableEvidenceCampaign, } from "./stable-evidence-campaign.js";
/** Writes JSON to a file with directory creation */
function writeJson(path, value) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value, null, 2));
}
/** Safely reads and parses JSON, returning null if not found */
function safeReadJson(path) {
    if (!existsSync(path)) {
        return null;
    }
    return JSON.parse(readFileSync(path, "utf8"));
}
/** Builds path to sequence state file */
function buildSequenceStatePath(evidenceRootDir) {
    return join(evidenceRootDir, "stable-evidence-sequence-state.json");
}
/** Builds path to sequence report file */
function buildSequenceReportPath(evidenceRootDir) {
    return join(evidenceRootDir, "stable-evidence-sequence-report.json");
}
/** Builds path to a campaign's state file */
function buildCampaignStatePath(outputDir) {
    return join(outputDir, "stable-evidence-campaign-state.json");
}
/** Builds path to a campaign's final evidence report */
function buildFinalEvidenceReportPath(outputDir) {
    return join(outputDir, "stable-evidence-report.json");
}
/** Returns default profile names for a sequence */
function defaultProfileNames() {
    return ["24h", "72h"];
}
/** Creates initial sequence state */
function buildInitialState(evidenceRootDir, profileNames) {
    const now = new Date().toISOString();
    return {
        sequenceId: `stable_evidence_sequence_${now}`,
        evidenceRootDir,
        profileNames,
        activeProfileName: profileNames[0] ?? null,
        completed: false,
        blocked: false,
        blockReason: null,
        startedAt: now,
        updatedAt: now,
        profiles: profileNames.map((profileName) => {
            const outputDir = join(evidenceRootDir, profileName);
            return {
                profileName,
                outputDir,
                campaignStatePath: buildCampaignStatePath(outputDir),
                finalEvidenceReportPath: buildFinalEvidenceReportPath(outputDir),
                startedAt: null,
                updatedAt: null,
                completed: false,
                passed: null,
                accumulatedDurationMs: 0,
                remainingDurationMs: 0,
                accumulatedWallClockDurationMs: 0,
                remainingWallClockDurationMs: 0,
                segmentCount: 0,
            };
        }),
    };
}
/**
 * Syncs a profile state from campaign state and evidence report on disk.
 */
function syncProfileState(profileState, campaignState, finalEvidenceReport) {
    if (!campaignState && !finalEvidenceReport) {
        return profileState;
    }
    const completed = campaignState?.completed ?? finalEvidenceReport !== null;
    const passed = campaignState?.finalEvidencePassed ?? finalEvidenceReport?.summary.passed ?? null;
    return {
        ...profileState,
        startedAt: campaignState?.startedAt ?? finalEvidenceReport?.startedAt ?? profileState.startedAt,
        updatedAt: campaignState?.updatedAt ?? finalEvidenceReport?.finishedAt ?? profileState.updatedAt,
        completed,
        passed,
        accumulatedDurationMs: campaignState?.accumulatedDurationMs ?? profileState.accumulatedDurationMs,
        remainingDurationMs: campaignState?.remainingDurationMs ?? profileState.remainingDurationMs,
        accumulatedWallClockDurationMs: campaignState?.accumulatedWallClockDurationMs
            ?? finalEvidenceReport?.acceptanceLine?.observed.soakDurationMs
            ?? profileState.accumulatedWallClockDurationMs,
        remainingWallClockDurationMs: campaignState?.remainingWallClockDurationMs ?? profileState.remainingWallClockDurationMs,
        segmentCount: campaignState?.segments.length ?? profileState.segmentCount,
    };
}
/** Syncs entire sequence state from disk */
function syncStateFromDisk(state) {
    const profiles = state.profiles.map((profile) => {
        const campaignState = safeReadJson(profile.campaignStatePath);
        const finalEvidenceReport = safeReadJson(profile.finalEvidenceReportPath);
        return syncProfileState(profile, campaignState, finalEvidenceReport);
    });
    const firstIncomplete = profiles.find((profile) => !profile.completed);
    const blockedProfile = profiles.find((profile) => profile.completed && profile.passed === false);
    return {
        ...state,
        profiles,
        activeProfileName: blockedProfile ? blockedProfile.profileName : firstIncomplete?.profileName ?? null,
        completed: profiles.length > 0 && profiles.every((profile) => profile.completed && profile.passed === true),
        blocked: blockedProfile !== undefined,
        blockReason: blockedProfile !== undefined
            ? `${blockedProfile.profileName} stable evidence completed with failing verdict`
            : null,
        updatedAt: new Date().toISOString(),
    };
}
/** Persists sequence artifacts to disk */
function persistSequenceArtifacts(report) {
    writeJson(buildSequenceStatePath(report.state.evidenceRootDir), report.state);
    writeJson(buildSequenceReportPath(report.state.evidenceRootDir), report);
}
/**
 * Loads existing sequence state or creates initial state.
 * Maps old profile states to new profile names if they differ.
 */
function loadSequenceState(evidenceRootDir, profileNames) {
    const loaded = safeReadJson(buildSequenceStatePath(evidenceRootDir));
    if (!loaded) {
        return buildInitialState(evidenceRootDir, profileNames);
    }
    return {
        ...loaded,
        evidenceRootDir,
        profileNames,
        profiles: profileNames.map((profileName) => {
            const existing = loaded.profiles.find((profile) => profile.profileName === profileName);
            const outputDir = join(evidenceRootDir, profileName);
            return existing
                ? {
                    ...existing,
                    outputDir,
                    campaignStatePath: buildCampaignStatePath(outputDir),
                    finalEvidenceReportPath: buildFinalEvidenceReportPath(outputDir),
                }
                : {
                    profileName,
                    outputDir,
                    campaignStatePath: buildCampaignStatePath(outputDir),
                    finalEvidenceReportPath: buildFinalEvidenceReportPath(outputDir),
                    startedAt: null,
                    updatedAt: null,
                    completed: false,
                    passed: null,
                    accumulatedDurationMs: 0,
                    remainingDurationMs: 0,
                    accumulatedWallClockDurationMs: 0,
                    remainingWallClockDurationMs: 0,
                    segmentCount: 0,
                };
        }),
    };
}
/**
 * Runs a stable evidence sequence.
 *
 * Executes campaigns sequentially, stopping if any campaign fails.
 * Persists state after each step for resumability.
 */
export async function runStableEvidenceSequence(options) {
    mkdirSync(options.evidenceRootDir, { recursive: true });
    const profileNames = options.profileNames ?? defaultProfileNames();
    // Load or initialize state
    let state = syncStateFromDisk(loadSequenceState(options.evidenceRootDir, profileNames));
    let lastCampaignReport = null;
    const advancedProfiles = [];
    persistSequenceArtifacts({ state, advancedProfiles, lastCampaignReport });
    // Return early if already done
    if (state.completed || state.blocked) {
        const report = { state, advancedProfiles, lastCampaignReport };
        persistSequenceArtifacts(report);
        return report;
    }
    // Main sequence loop
    while (true) {
        // Find first incomplete profile
        const activeProfile = state.profiles.find((profile) => !profile.completed);
        if (!activeProfile) {
            state = {
                ...state,
                activeProfileName: null,
                completed: true,
                blocked: false,
                blockReason: null,
                updatedAt: new Date().toISOString(),
            };
            break;
        }
        state = {
            ...state,
            activeProfileName: activeProfile.profileName,
            updatedAt: new Date().toISOString(),
        };
        persistSequenceArtifacts({ state, advancedProfiles, lastCampaignReport });
        // Check if this profile's campaign is already complete
        const existingCampaignState = safeReadJson(activeProfile.campaignStatePath);
        if (existingCampaignState?.completed) {
            const updatedActiveProfile = syncProfileState(activeProfile, existingCampaignState, safeReadJson(activeProfile.finalEvidenceReportPath));
            state = {
                ...state,
                profiles: state.profiles.map((profile) => profile.profileName === activeProfile.profileName ? updatedActiveProfile : profile),
                updatedAt: new Date().toISOString(),
            };
            // Check if it passed
            if (updatedActiveProfile.passed !== true) {
                state = {
                    ...state,
                    blocked: true,
                    blockReason: `${updatedActiveProfile.profileName} stable evidence completed with failing verdict`,
                    updatedAt: new Date().toISOString(),
                };
                break;
            }
            advancedProfiles.push(updatedActiveProfile.profileName);
            continue;
        }
        // Run campaign for this profile
        const profileOptions = options.profileOptions?.[activeProfile.profileName] ?? {};
        lastCampaignReport = await runStableEvidenceCampaign({
            outputDir: activeProfile.outputDir,
            profileName: activeProfile.profileName,
            ...profileOptions,
        });
        // Update profile state
        const updatedActiveProfile = syncProfileState(activeProfile, lastCampaignReport.state, lastCampaignReport.finalEvidenceReport);
        state = {
            ...state,
            profiles: state.profiles.map((profile) => profile.profileName === activeProfile.profileName ? updatedActiveProfile : profile),
            updatedAt: new Date().toISOString(),
        };
        // Check if campaign completed
        if (!updatedActiveProfile.completed) {
            break;
        }
        // Check if campaign passed
        if (updatedActiveProfile.passed !== true) {
            state = {
                ...state,
                blocked: true,
                blockReason: `${updatedActiveProfile.profileName} stable evidence completed with failing verdict`,
                updatedAt: new Date().toISOString(),
            };
            break;
        }
        advancedProfiles.push(updatedActiveProfile.profileName);
    }
    state = syncStateFromDisk(state);
    const report = { state, advancedProfiles, lastCampaignReport };
    persistSequenceArtifacts(report);
    return report;
}
/**
 * Runs the evidence sequence with polling until complete or blocked.
 *
 * Useful for running in environments where the process may be restarted
 * before the sequence completes.
 */
export async function runStableEvidenceSequenceUntilComplete(options) {
    let report = await runStableEvidenceSequence(options);
    let passes = 1;
    const sleepMs = options.sleepMs ?? 0;
    while (!report.state.completed && !report.state.blocked) {
        if (options.maxPasses !== undefined && passes >= options.maxPasses) {
            return report;
        }
        if (sleepMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, sleepMs));
        }
        report = await runStableEvidenceSequence(options);
        passes += 1;
    }
    return report;
}
//# sourceMappingURL=stable-evidence-sequence.js.map