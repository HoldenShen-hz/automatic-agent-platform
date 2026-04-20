import type { EnvironmentName } from "../../contracts/types/domain.js";
import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";

const RELEASE_ACTIONS = ["summary", "export", "execute", "list"] as const;
const RELEASE_RUNNERS = ["local", "simulate"] as const;
const ROLLOUT_STRATEGIES = ["rolling", "canary", "blue_green"] as const;
const ENVIRONMENTS = ["dev", "test", "staging", "pre-prod", "prod"] as const;

export interface ReleasePipelineCliEnvConfig {
  action: typeof RELEASE_ACTIONS[number];
  dbPath: string | null;
  runnerMode: typeof RELEASE_RUNNERS[number];
  triggerDeploy: boolean;
  environment: EnvironmentName | null;
  version: string | null;
  commitSha: string | null;
  rolloutStrategy: "rolling" | "canary" | "blue_green" | null;
  registry: string | null;
  imageRepository: string | null;
  taskId: string | null;
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = readTrimmedEnv(env, name);
  if (value == null) {
    throw new ValidationError(`release.missing_env:${name}`, `release.missing_env:${name}`);
  }
  return value;
}

function optionalEnv(env: NodeJS.ProcessEnv, name: string): string | null {
  return readTrimmedEnv(env, name) ?? null;
}

function readAction(env: NodeJS.ProcessEnv): ReleasePipelineCliEnvConfig["action"] {
  const action = readTrimmedEnv(env, "AA_RELEASE_ACTION") ?? "summary";
  if (!RELEASE_ACTIONS.includes(action as ReleasePipelineCliEnvConfig["action"])) {
    throw new ValidationError("release.invalid_action", `release.invalid_action:${action}`);
  }
  return action as ReleasePipelineCliEnvConfig["action"];
}

function readRunner(env: NodeJS.ProcessEnv): ReleasePipelineCliEnvConfig["runnerMode"] {
  const runner = readTrimmedEnv(env, "AA_RELEASE_RUNNER") ?? "local";
  if (!RELEASE_RUNNERS.includes(runner as ReleasePipelineCliEnvConfig["runnerMode"])) {
    throw new ValidationError("release.invalid_runner", `release.invalid_runner:${runner}`);
  }
  return runner as ReleasePipelineCliEnvConfig["runnerMode"];
}

function readEnvironment(env: NodeJS.ProcessEnv, action: ReleasePipelineCliEnvConfig["action"]): EnvironmentName | null {
  if (action === "list") {
    return optionalEnv(env, "AA_RELEASE_ENVIRONMENT") as EnvironmentName | null;
  }
  const value = requiredEnv(env, "AA_RELEASE_ENVIRONMENT");
  if (!ENVIRONMENTS.includes(value as EnvironmentName)) {
    throw new ValidationError("release.invalid_environment", `release.invalid_environment:${value}`);
  }
  return value as EnvironmentName;
}

function readRolloutStrategy(
  env: NodeJS.ProcessEnv,
  action: ReleasePipelineCliEnvConfig["action"],
): ReleasePipelineCliEnvConfig["rolloutStrategy"] {
  if (action === "list") {
    return optionalEnv(env, "AA_RELEASE_ROLLOUT_STRATEGY") as ReleasePipelineCliEnvConfig["rolloutStrategy"];
  }
  const value = requiredEnv(env, "AA_RELEASE_ROLLOUT_STRATEGY");
  if (!ROLLOUT_STRATEGIES.includes(value as NonNullable<ReleasePipelineCliEnvConfig["rolloutStrategy"]>)) {
    throw new ValidationError("release.invalid_rollout_strategy", `release.invalid_rollout_strategy:${value}`);
  }
  return value as NonNullable<ReleasePipelineCliEnvConfig["rolloutStrategy"]>;
}

function readVersionLikeEnv(
  env: NodeJS.ProcessEnv,
  action: ReleasePipelineCliEnvConfig["action"],
  name: "AA_RELEASE_VERSION" | "AA_RELEASE_COMMIT_SHA",
): string | null {
  if (action === "list") {
    return optionalEnv(env, name);
  }
  return requiredEnv(env, name);
}

export function loadReleasePipelineCliEnv(env: NodeJS.ProcessEnv = process.env): ReleasePipelineCliEnvConfig {
  const action = readAction(env);
  return {
    action,
    dbPath: optionalEnv(env, "AA_DB_PATH"),
    runnerMode: readRunner(env),
    triggerDeploy: readTrimmedEnv(env, "AA_RELEASE_TRIGGER_DEPLOY") === "true",
    environment: readEnvironment(env, action),
    version: readVersionLikeEnv(env, action, "AA_RELEASE_VERSION"),
    commitSha: readVersionLikeEnv(env, action, "AA_RELEASE_COMMIT_SHA"),
    rolloutStrategy: readRolloutStrategy(env, action),
    registry: optionalEnv(env, "AA_RELEASE_REGISTRY"),
    imageRepository: optionalEnv(env, "AA_RELEASE_IMAGE_REPOSITORY"),
    taskId: optionalEnv(env, "AA_RELEASE_TASK_ID"),
  };
}
