declare module "../../../scripts/run-node-tests.mjs" {
  export const DEFAULT_NODE_TEST_CONCURRENCY: number;
  export function readNodeTestConcurrency(env: Record<string, string | undefined>): number;
  export function buildNodeTestArgs(
    testFiles: readonly string[],
    env: Record<string, string | undefined>,
  ): string[];
}

declare module "../../../scripts/dev/local-stack-lib.mjs" {
  export function buildLocalStackChildEnv(
    baseEnv: Record<string, string | undefined>,
    overrides?: Record<string, string | undefined>,
  ): Record<string, string>;

  export function classifyPortListeners(
    listenerPids: readonly number[],
    trackedPids: readonly (number | null)[],
  ): {
    managedPids: number[];
    unmanagedPids: number[];
  };

  export function readLocalStackPort(
    env: Record<string, string | undefined>,
    key: string,
    fallback: number,
  ): number;

  export function resolveRequiredBinaryPath(binaryName: string, candidates: readonly string[]): string;
  export function resolveRequiredNpmCliPath(nodePath: string, env: Record<string, string | undefined>): string;
}

declare module "../../../../scripts/assurance/review-import-lib.mjs" {
  export function buildReviewImportArtifacts(input: {
    repoRoot: string;
    reviewsRoot: string;
    outputDir: string;
    generatedAt?: string;
  }): any;
}

declare module "../../../../scripts/assurance/historical-promises-lib.mjs" {
  export function buildHistoricalPromiseArtifacts(input: {
    repoRoot: string;
    outputDir: string;
  }): any;

  export function evaluateHistoricalPromiseArtifacts(input: unknown): any;
}
