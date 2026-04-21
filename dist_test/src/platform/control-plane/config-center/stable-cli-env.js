import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";
const STABLE_PROFILES = ["smoke", "24h", "72h"];
function optionalPositiveNumber(env, name) {
    const raw = readTrimmedEnv(env, name);
    if (raw == null) {
        return null;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new ValidationError(`stable.invalid_env:${name}`, `stable.invalid_env:${name}`);
    }
    return parsed;
}
function readProfile(env) {
    const profile = readTrimmedEnv(env, "AA_STABLE_CAMPAIGN_PROFILE") ?? "smoke";
    if (!STABLE_PROFILES.includes(profile)) {
        throw new ValidationError("stable.invalid_campaign_profile", `stable.invalid_campaign_profile:${profile}`);
    }
    return profile;
}
function readOutputDir(env, profile) {
    const fromEnv = readTrimmedEnv(env, "AA_STABLE_CAMPAIGN_OUTPUT_DIR");
    if (fromEnv != null) {
        return fromEnv;
    }
    const outputDir = join(process.cwd(), "data", "stable-campaign", profile);
    mkdirSync(outputDir, { recursive: true });
    return outputDir;
}
export function loadStableCampaignCliEnv(env = process.env) {
    const profile = readProfile(env);
    return {
        profile,
        outputDir: readOutputDir(env, profile),
        targetDurationMs: optionalPositiveNumber(env, "AA_STABLE_CAMPAIGN_TARGET_DURATION_MS"),
        segmentDurationMs: optionalPositiveNumber(env, "AA_STABLE_CAMPAIGN_SEGMENT_DURATION_MS"),
        intervalMs: optionalPositiveNumber(env, "AA_STABLE_CAMPAIGN_INTERVAL_MS"),
        iterationsPerCycle: optionalPositiveNumber(env, "AA_STABLE_CAMPAIGN_ITERATIONS_PER_CYCLE"),
        validationIterations: optionalPositiveNumber(env, "AA_STABLE_CAMPAIGN_VALIDATION_ITERATIONS"),
    };
}
function optionalBoolean(env, name) {
    const raw = readTrimmedEnv(env, name)?.toLowerCase();
    if (raw == null) {
        return null;
    }
    if (raw === "1" || raw === "true" || raw === "yes") {
        return true;
    }
    if (raw === "0" || raw === "false" || raw === "no") {
        return false;
    }
    throw new ValidationError(`stable.invalid_env:${name}`, `stable.invalid_env:${name}`);
}
function readEvidenceRootDir(env) {
    const fromEnv = readTrimmedEnv(env, "AA_STABLE_SEQUENCE_EVIDENCE_ROOT");
    if (fromEnv != null) {
        return fromEnv;
    }
    const outputDir = join(process.cwd(), "data", "stable-evidence");
    mkdirSync(outputDir, { recursive: true });
    return outputDir;
}
function readSequenceProfiles(env) {
    const raw = readTrimmedEnv(env, "AA_STABLE_SEQUENCE_PROFILES");
    if (raw == null) {
        return ["24h", "72h"];
    }
    const parsed = raw
        .split(",")
        .map((value) => value.trim())
        .filter((value) => STABLE_PROFILES.includes(value));
    return parsed.length > 0 ? parsed : ["24h", "72h"];
}
function readStableEvidenceProfile(env) {
    const profile = readTrimmedEnv(env, "AA_STABLE_EVIDENCE_PROFILE") ?? "smoke";
    if (!STABLE_PROFILES.includes(profile)) {
        throw new ValidationError("stable.invalid_evidence_profile", `stable.invalid_evidence_profile:${profile}`);
    }
    return profile;
}
function readStableOutputDir(env, envVar, fallbackDir) {
    const fromEnv = readTrimmedEnv(env, envVar);
    if (fromEnv != null) {
        return fromEnv;
    }
    const outputDir = join(process.cwd(), fallbackDir);
    mkdirSync(outputDir, { recursive: true });
    return outputDir;
}
function readGateTargetStatus(env, name) {
    const value = readTrimmedEnv(env, name) ?? "canary";
    if (value !== "canary" && value !== "tenant_gray" && value !== "production_ready") {
        throw new ValidationError("stable.invalid_gate_target_status", `stable.invalid_gate_target_status:${value}`);
    }
    return value;
}
export function loadStableSequenceCliEnv(env = process.env) {
    const targetDurationMs = optionalPositiveNumber(env, "AA_STABLE_SEQUENCE_TARGET_DURATION_MS");
    const segmentDurationMs = optionalPositiveNumber(env, "AA_STABLE_SEQUENCE_SEGMENT_DURATION_MS");
    const intervalMs = optionalPositiveNumber(env, "AA_STABLE_SEQUENCE_INTERVAL_MS");
    const iterationsPerCycle = optionalPositiveNumber(env, "AA_STABLE_SEQUENCE_ITERATIONS_PER_CYCLE");
    const validationIterations = optionalPositiveNumber(env, "AA_STABLE_SEQUENCE_VALIDATION_ITERATIONS");
    const sleepMs = optionalPositiveNumber(env, "AA_STABLE_SEQUENCE_SLEEP_MS") ?? 0;
    const maxPasses = optionalPositiveNumber(env, "AA_STABLE_SEQUENCE_MAX_PASSES");
    const enforceWallClockDuration = optionalBoolean(env, "AA_STABLE_SEQUENCE_ENFORCE_WALL_CLOCK");
    return {
        evidenceRootDir: readEvidenceRootDir(env),
        profileNames: readSequenceProfiles(env),
        sharedProfileOptions: {
            ...(targetDurationMs != null ? { targetDurationMs } : {}),
            ...(segmentDurationMs != null ? { segmentDurationMs } : {}),
            ...(intervalMs != null ? { intervalMs } : {}),
            ...(iterationsPerCycle != null ? { iterationsPerCycle } : {}),
            ...(validationIterations != null ? { validationIterations } : {}),
            ...(enforceWallClockDuration != null ? { enforceWallClockDuration } : {}),
        },
        runUntilComplete: optionalBoolean(env, "AA_STABLE_SEQUENCE_RUN_UNTIL_COMPLETE") ?? false,
        sleepMs,
        maxPasses,
    };
}
export function loadStableEvidenceCliEnv(env = process.env) {
    return {
        profile: readStableEvidenceProfile(env),
        outputDir: readStableOutputDir(env, "AA_STABLE_EVIDENCE", "data/stable-evidence/smoke"),
        validationIterations: optionalPositiveNumber(env, "AA_STABLE_EVIDENCE_VALIDATION_ITERATIONS"),
        durationMs: optionalPositiveNumber(env, "AA_STABLE_EVIDENCE_DURATION_MS"),
        intervalMs: optionalPositiveNumber(env, "AA_STABLE_EVIDENCE_INTERVAL_MS"),
        iterationsPerCycle: optionalPositiveNumber(env, "AA_STABLE_EVIDENCE_ITERATIONS_PER_CYCLE"),
    };
}
export function loadStableGateCliEnv(env = process.env) {
    return {
        outputDir: readStableOutputDir(env, "AA_STABLE_GATE", "data/stable-gate"),
        evidenceRootDir: readTrimmedEnv(env, "AA_STABLE_GATE_EVIDENCE_ROOT"),
        targetStatus: readGateTargetStatus(env, "AA_STABLE_GATE_TARGET_STATUS"),
    };
}
export function loadStablePackageCliEnv(env = process.env) {
    return {
        outputDir: readStableOutputDir(env, "AA_STABLE_PACKAGE", "data/stable-package"),
        evidenceRootDir: readTrimmedEnv(env, "AA_STABLE_PACKAGE_EVIDENCE_ROOT"),
        targetStatus: readGateTargetStatus(env, "AA_STABLE_PACKAGE_TARGET_STATUS"),
    };
}
export function loadStableValidateCliEnv(env = process.env) {
    return {
        iterations: optionalPositiveNumber(env, "AA_VALIDATION_ITERATIONS") ?? 3,
    };
}
export function loadStableSoakCliEnv(env = process.env) {
    return {
        durationMs: optionalPositiveNumber(env, "AA_SOAK_DURATION_MS") ?? 5_000,
        intervalMs: optionalPositiveNumber(env, "AA_SOAK_INTERVAL_MS") ?? 500,
        iterationsPerCycle: optionalPositiveNumber(env, "AA_SOAK_ITERATIONS_PER_CYCLE") ?? 1,
    };
}
//# sourceMappingURL=stable-cli-env.js.map