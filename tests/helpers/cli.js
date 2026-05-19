import { execFileSync } from "node:child_process";
import { join } from "node:path";
export { reportSoftPerformanceMiss, failOnListenSocketDenied } from "./performance.js";
export function runBuiltCliExpectFailure(scriptName, env) {
    try {
        execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "sdk", "cli", scriptName)], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                ...env,
            },
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
        throw new Error(`expected_cli_failure:${scriptName}`);
    }
    catch (error) {
        if (error instanceof Error && error.message === `expected_cli_failure:${scriptName}`) {
            throw error;
        }
        const failure = error;
        return {
            stdout: failure.stdout ?? "",
            stderr: failure.stderr ?? "",
            status: failure.status ?? 1,
        };
    }
}
//# sourceMappingURL=cli.js.map
