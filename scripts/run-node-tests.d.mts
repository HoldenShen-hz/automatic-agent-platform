export const DEFAULT_NODE_TEST_CONCURRENCY: number;
export function readNodeTestConcurrency(env: Record<string, string | undefined>): number;
export function buildNodeTestArgs(
  testFiles: readonly string[],
  env: Record<string, string | undefined>,
): string[];
