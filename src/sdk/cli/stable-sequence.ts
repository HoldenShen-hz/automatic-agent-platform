import { pathToFileURL } from "node:url";

import {
  runStableEvidenceSequence,
  runStableEvidenceSequenceUntilComplete,
} from "../../platform/shared/stability/stable-evidence-sequence.js";
import { CLI_EXIT_FAILURE, CLI_EXIT_SUCCESS, runCliMain } from "./cli-exit.js";
import { loadStableSequenceCliEnv } from "../../platform/five-plane-control-plane/config-center/stable-cli-env.js";

/**
 * Main entry point for the stable evidence sequence CLI.
 * Runs evidence collection profiles in sequence, optionally running until complete.
 * Outputs the final report to console and sets exit code based on blocking status.
 */
async function main(): Promise<number> {
  const envConfig = loadStableSequenceCliEnv();
  const options = {
    evidenceRootDir: envConfig.evidenceRootDir,
    profileNames: envConfig.profileNames,
    profileOptions: Object.fromEntries(
      envConfig.profileNames.map((profileName) => [profileName, envConfig.sharedProfileOptions]),
    ),
  };

  const report = envConfig.runUntilComplete
    ? await runStableEvidenceSequenceUntilComplete({
        ...options,
        sleepMs: envConfig.sleepMs,
        ...(envConfig.maxPasses !== null ? { maxPasses: envConfig.maxPasses } : {}),
      })
    : await runStableEvidenceSequence(options);

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.state.blocked ? CLI_EXIT_FAILURE : CLI_EXIT_SUCCESS;
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCliMain(main, {
    onError: (err) => {
      process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    },
  });
}
