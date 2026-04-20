import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";
import type { StableEvidenceProfileName } from "../../shared/stability/stable-evidence-bundle.js";

const STABLE_PROFILES = ["smoke", "24h", "72h"] as const;

export interface StableCampaignCliEnvConfig {
  profile: StableEvidenceProfileName;
  outputDir: string;
  targetDurationMs: number | null;
  segmentDurationMs: number | null;
  intervalMs: number | null;
  iterationsPerCycle: number | null;
  validationIterations: number | null;
}

export interface StableSequenceCliEnvConfig {
  evidenceRootDir: string;
  profileNames: StableEvidenceProfileName[];
  sharedProfileOptions: {
    targetDurationMs?: number;
    segmentDurationMs?: number;
    intervalMs?: number;
    iterationsPerCycle?: number;
    validationIterations?: number;
    enforceWallClockDuration?: boolean;
  };
  runUntilComplete: boolean;
  sleepMs: number;
  maxPasses: number | null;
}

export interface StableEvidenceCliEnvConfig {
  profile: StableEvidenceProfileName;
  outputDir: string;
  validationIterations: number | null;
  durationMs: number | null;
  intervalMs: number | null;
  iterationsPerCycle: number | null;
}

export interface StableGateCliEnvConfig {
  outputDir: string;
  evidenceRootDir: string | null;
  targetStatus: "canary" | "tenant_gray" | "production_ready";
}

export interface StablePackageCliEnvConfig {
  outputDir: string;
  evidenceRootDir: string | null;
  targetStatus: "canary" | "tenant_gray" | "production_ready";
}

export interface StableValidateCliEnvConfig {
  iterations: number;
}

export interface StableSoakCliEnvConfig {
  durationMs: number;
  intervalMs: number;
  iterationsPerCycle: number;
}

function optionalPositiveNumber(env: NodeJS.ProcessEnv, name: string): number | null {
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

function readProfile(env: NodeJS.ProcessEnv): StableEvidenceProfileName {
  const profile = readTrimmedEnv(env, "AA_STABLE_CAMPAIGN_PROFILE") ?? "smoke";
  if (!STABLE_PROFILES.includes(profile as StableEvidenceProfileName)) {
    throw new ValidationError("stable.invalid_campaign_profile", `stable.invalid_campaign_profile:${profile}`);
  }
  return profile as StableEvidenceProfileName;
}

function readOutputDir(env: NodeJS.ProcessEnv, profile: StableEvidenceProfileName): string {
  const fromEnv = readTrimmedEnv(env, "AA_STABLE_CAMPAIGN_OUTPUT_DIR");
  if (fromEnv != null) {
    return fromEnv;
  }

  const outputDir = join(process.cwd(), "data", "stable-campaign", profile);
  mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

export function loadStableCampaignCliEnv(env: NodeJS.ProcessEnv = process.env): StableCampaignCliEnvConfig {
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

function optionalBoolean(env: NodeJS.ProcessEnv, name: string): boolean | null {
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

function readEvidenceRootDir(env: NodeJS.ProcessEnv): string {
  const fromEnv = readTrimmedEnv(env, "AA_STABLE_SEQUENCE_EVIDENCE_ROOT");
  if (fromEnv != null) {
    return fromEnv;
  }
  const outputDir = join(process.cwd(), "data", "stable-evidence");
  mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

function readSequenceProfiles(env: NodeJS.ProcessEnv): StableEvidenceProfileName[] {
  const raw = readTrimmedEnv(env, "AA_STABLE_SEQUENCE_PROFILES");
  if (raw == null) {
    return ["24h", "72h"];
  }
  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is StableEvidenceProfileName => STABLE_PROFILES.includes(value as StableEvidenceProfileName));
  return parsed.length > 0 ? parsed : ["24h", "72h"];
}

function readStableEvidenceProfile(env: NodeJS.ProcessEnv): StableEvidenceProfileName {
  const profile = readTrimmedEnv(env, "AA_STABLE_EVIDENCE_PROFILE") ?? "smoke";
  if (!STABLE_PROFILES.includes(profile as StableEvidenceProfileName)) {
    throw new ValidationError("stable.invalid_evidence_profile", `stable.invalid_evidence_profile:${profile}`);
  }
  return profile as StableEvidenceProfileName;
}

function readStableOutputDir(env: NodeJS.ProcessEnv, envVar: string, fallbackDir: string): string {
  const fromEnv = readTrimmedEnv(env, envVar);
  if (fromEnv != null) {
    return fromEnv;
  }
  const outputDir = join(process.cwd(), fallbackDir);
  mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

function readGateTargetStatus(
  env: NodeJS.ProcessEnv,
  name: string,
): StableGateCliEnvConfig["targetStatus"] {
  const value = readTrimmedEnv(env, name) ?? "canary";
  if (value !== "canary" && value !== "tenant_gray" && value !== "production_ready") {
    throw new ValidationError("stable.invalid_gate_target_status", `stable.invalid_gate_target_status:${value}`);
  }
  return value;
}

export function loadStableSequenceCliEnv(env: NodeJS.ProcessEnv = process.env): StableSequenceCliEnvConfig {
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

export function loadStableEvidenceCliEnv(env: NodeJS.ProcessEnv = process.env): StableEvidenceCliEnvConfig {
  return {
    profile: readStableEvidenceProfile(env),
    outputDir: readStableOutputDir(env, "AA_STABLE_EVIDENCE", "data/stable-evidence/smoke"),
    validationIterations: optionalPositiveNumber(env, "AA_STABLE_EVIDENCE_VALIDATION_ITERATIONS"),
    durationMs: optionalPositiveNumber(env, "AA_STABLE_EVIDENCE_DURATION_MS"),
    intervalMs: optionalPositiveNumber(env, "AA_STABLE_EVIDENCE_INTERVAL_MS"),
    iterationsPerCycle: optionalPositiveNumber(env, "AA_STABLE_EVIDENCE_ITERATIONS_PER_CYCLE"),
  };
}

export function loadStableGateCliEnv(env: NodeJS.ProcessEnv = process.env): StableGateCliEnvConfig {
  return {
    outputDir: readStableOutputDir(env, "AA_STABLE_GATE", "data/stable-gate"),
    evidenceRootDir: readTrimmedEnv(env, "AA_STABLE_GATE_EVIDENCE_ROOT"),
    targetStatus: readGateTargetStatus(env, "AA_STABLE_GATE_TARGET_STATUS"),
  };
}

export function loadStablePackageCliEnv(env: NodeJS.ProcessEnv = process.env): StablePackageCliEnvConfig {
  return {
    outputDir: readStableOutputDir(env, "AA_STABLE_PACKAGE", "data/stable-package"),
    evidenceRootDir: readTrimmedEnv(env, "AA_STABLE_PACKAGE_EVIDENCE_ROOT"),
    targetStatus: readGateTargetStatus(env, "AA_STABLE_PACKAGE_TARGET_STATUS"),
  };
}

export function loadStableValidateCliEnv(env: NodeJS.ProcessEnv = process.env): StableValidateCliEnvConfig {
  return {
    iterations: optionalPositiveNumber(env, "AA_VALIDATION_ITERATIONS") ?? 3,
  };
}

export function loadStableSoakCliEnv(env: NodeJS.ProcessEnv = process.env): StableSoakCliEnvConfig {
  return {
    durationMs: optionalPositiveNumber(env, "AA_SOAK_DURATION_MS") ?? 5_000,
    intervalMs: optionalPositiveNumber(env, "AA_SOAK_INTERVAL_MS") ?? 500,
    iterationsPerCycle: optionalPositiveNumber(env, "AA_SOAK_ITERATIONS_PER_CYCLE") ?? 1,
  };
}
