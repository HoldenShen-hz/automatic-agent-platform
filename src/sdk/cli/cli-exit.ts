import { pathToFileURL } from "node:url";

export const CLI_EXIT_SUCCESS = 0;
export const CLI_EXIT_FAILURE = 1;

export type CliMainResult = number | boolean | void | null | undefined | Promise<number | boolean | void | null | undefined>;

export function isCliEntryPoint(importMetaUrl: string): boolean {
  return process.argv[1] != null && importMetaUrl === pathToFileURL(process.argv[1]).href;
}

export function normalizeCliExitCode(result: number | boolean): number {
  if (typeof result === "boolean") {
    return result ? CLI_EXIT_SUCCESS : CLI_EXIT_FAILURE;
  }
  if (!Number.isFinite(result)) {
    return CLI_EXIT_FAILURE;
  }
  return Math.max(0, Math.trunc(result));
}

export async function runCliMain(
  main: () => CliMainResult,
  options: { onError?: (error: unknown) => void } = {},
): Promise<void> {
  try {
    const result = await main();
    if (typeof result === "number" || typeof result === "boolean") {
      process.exitCode = normalizeCliExitCode(result);
      return;
    }
    if (process.exitCode == null) {
      process.exitCode = CLI_EXIT_SUCCESS;
    }
  } catch (error) {
    options.onError?.(error);
    process.exitCode = CLI_EXIT_FAILURE;
  }
}
