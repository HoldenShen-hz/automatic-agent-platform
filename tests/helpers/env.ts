/**
 * Environment variable utility for tests.
 *
 * Provides a clean way to save/restore environment variables with proper
 * handling of undefined values (restoring undefined means deleting the key).
 */

export async function withEnv(
  overrides: Record<string, string>,
  fn: () => Promise<void> | void,
): Promise<void> {
  const saved = new Map<string, string | undefined>();
  for (const key of Object.keys(overrides)) {
    saved.set(key, process.env[key]);
    process.env[key] = overrides[key];
  }
  try {
    await fn();
  } finally {
    for (const [key, prev] of saved) {
      if (prev === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prev;
      }
    }
  }
}

/**
 * Synchronous version of withEnv.
 */
export function withEnvSync(
  overrides: Record<string, string>,
  fn: () => void,
): void {
  const saved = new Map<string, string | undefined>();
  for (const key of Object.keys(overrides)) {
    saved.set(key, process.env[key]);
    process.env[key] = overrides[key];
  }
  try {
    fn();
  } finally {
    for (const [key, prev] of saved) {
      if (prev === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prev;
      }
    }
  }
}
