import type { EnvironmentName } from "../../contracts/types/domain.js";
declare const RELEASE_ACTIONS: readonly ["summary", "export", "execute", "list"];
declare const RELEASE_RUNNERS: readonly ["local", "simulate"];
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
export declare function loadReleasePipelineCliEnv(env?: NodeJS.ProcessEnv): ReleasePipelineCliEnvConfig;
export {};
