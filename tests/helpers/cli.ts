import { execFileSync } from "node:child_process";
import { join } from "node:path";

export function runBuiltCliExpectFailure(
  scriptName: string,
  env: NodeJS.ProcessEnv,
): { stdout: string; stderr: string; status: number } {
  try {
    execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "cli", scriptName)], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    throw new Error(`expected_cli_failure:${scriptName}`);
  } catch (error) {
    if (error instanceof Error && error.message === `expected_cli_failure:${scriptName}`) {
      throw error;
    }
    const failure = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
      status: failure.status ?? 1,
    };
  }
}
