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

export function loadLocalStackProviderEnv(
  repoRoot: string,
  sourceEnv?: Record<string, string | undefined>,
): {
  env: Record<string, string>;
  sourcePath: string | null;
};

export function readLocalStackPort(
  env: Record<string, string | undefined>,
  key: string,
  fallback: number,
): number;

export function resolveRequiredBinaryPath(binaryName: string, candidates: readonly string[]): string;
export function resolveRequiredNpmCliPath(nodePath: string, env: Record<string, string | undefined>): string;
