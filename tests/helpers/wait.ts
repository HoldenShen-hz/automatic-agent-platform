export interface WaitForConditionOptions {
  readonly timeoutMs?: number;
  readonly intervalMs?: number;
  readonly description?: string;
}

const DEFAULT_WAIT_TIMEOUT_MS = resolveDefaultWaitTimeoutMs();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForCondition(
  predicate: () => boolean | Promise<boolean>,
  options: WaitForConditionOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? 10;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    if (await predicate()) {
      return;
    }
    await sleep(intervalMs);
  }

  const description = options.description ?? "condition";
  throw new Error(`Timed out waiting for ${description} after ${timeoutMs}ms`);
}

function resolveDefaultWaitTimeoutMs(): number {
  const raw = process.env.AA_TEST_WAIT_TIMEOUT_MS;
  if (raw != null && raw.trim().length > 0) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return process.env.CI != null ? 3_000 : 1_500;
}
