import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";
const RELEASE_ACTIONS = ["summary", "export", "execute", "list"];
const RELEASE_RUNNERS = ["local", "simulate"];
const ROLLOUT_STRATEGIES = ["rolling", "canary", "blue_green"];
const ENVIRONMENTS = ["dev", "test", "staging", "pre-prod", "prod"];
function requiredEnv(env, name) {
    const value = readTrimmedEnv(env, name);
    if (value == null) {
        throw new ValidationError(`release.missing_env:${name}`, `release.missing_env:${name}`);
    }
    return value;
}
function optionalEnv(env, name) {
    return readTrimmedEnv(env, name) ?? null;
}
function readAction(env) {
    const action = readTrimmedEnv(env, "AA_RELEASE_ACTION") ?? "summary";
    if (!RELEASE_ACTIONS.includes(action)) {
        throw new ValidationError("release.invalid_action", `release.invalid_action:${action}`);
    }
    return action;
}
function readRunner(env) {
    const runner = readTrimmedEnv(env, "AA_RELEASE_RUNNER") ?? "local";
    if (!RELEASE_RUNNERS.includes(runner)) {
        throw new ValidationError("release.invalid_runner", `release.invalid_runner:${runner}`);
    }
    return runner;
}
function readEnvironment(env, action) {
    if (action === "list") {
        return optionalEnv(env, "AA_RELEASE_ENVIRONMENT");
    }
    const value = requiredEnv(env, "AA_RELEASE_ENVIRONMENT");
    if (!ENVIRONMENTS.includes(value)) {
        throw new ValidationError("release.invalid_environment", `release.invalid_environment:${value}`);
    }
    return value;
}
function readRolloutStrategy(env, action) {
    if (action === "list") {
        return optionalEnv(env, "AA_RELEASE_ROLLOUT_STRATEGY");
    }
    const value = requiredEnv(env, "AA_RELEASE_ROLLOUT_STRATEGY");
    if (!ROLLOUT_STRATEGIES.includes(value)) {
        throw new ValidationError("release.invalid_rollout_strategy", `release.invalid_rollout_strategy:${value}`);
    }
    return value;
}
function readVersionLikeEnv(env, action, name) {
    if (action === "list") {
        return optionalEnv(env, name);
    }
    return requiredEnv(env, name);
}
export function loadReleasePipelineCliEnv(env = process.env) {
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
//# sourceMappingURL=release-pipeline-env.js.map