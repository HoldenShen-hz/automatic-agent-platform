/**
 * Stable Evidence Campaign CLI Entry Point
 *
 * This script runs a long-running evidence collection campaign that executes
 * test iterations across multiple cycles. It supports configurable profiles
 * (smoke, 24h, 72h) and allows fine-tuning of timing parameters via environment
 * variables. The campaign produces evidence bundles that can be used for
 * gate evaluation and regression analysis.
 *
 * See Also:
 *   - {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md | Quality Engineering And Chaos Testing Contract}
 *   - {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary And Terminology}
 *   - {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture And Technical Design}
 *
 * Environment Variables:
 *   AA_STABLE_CAMPAIGN_PROFILE              - Set to "smoke", "24h", or "72h" (defaults to "smoke")
 *   AA_STABLE_CAMPAIGN_TARGET_DURATION_MS   - Total target duration for the campaign
 *   AA_STABLE_CAMPAIGN_SEGMENT_DURATION_MS  - Duration of each campaign segment
 *   AA_STABLE_CAMPAIGN_INTERVAL_MS          - Interval between iteration cycles
 *   AA_STABLE_CAMPAIGN_ITERATIONS_PER_CYCLE - Number of iterations per cycle
 *   AA_STABLE_CAMPAIGN_VALIDATION_ITERATIONS - Number of validation iterations to run
 *   AA_STABLE_CAMPAIGN_OUTPUT_DIR           - Override the output directory path
 *
 * Exit Codes:
 *   0 - Campaign completed successfully with passing evidence
 *   1 - Campaign failed or evidence did not pass validation
 */

import { pathToFileURL } from "node:url";

import {
  runStableEvidenceCampaign,
} from "../../platform/shared/stability/stable-evidence-campaign.js";
import { CLI_EXIT_FAILURE, CLI_EXIT_SUCCESS, runCliMain } from "./cli-exit.js";
import { loadStableCampaignCliEnv } from "../../platform/five-plane-control-plane/config-center/stable-cli-env.js";

/**
 * Main entry point for the stable evidence campaign CLI.
 *
 * Orchestrates a multi-cycle evidence collection campaign using the resolved
 * profile and timing parameters. Outputs the final report to console and sets
 * the process exit code based on whether the final evidence passed validation.
 */
async function main(): Promise<number> {
  const envConfig = loadStableCampaignCliEnv();
  const profile = envConfig.profile;
  const report = await runStableEvidenceCampaign({
    outputDir: envConfig.outputDir,
    profileName: profile,
    ...(envConfig.targetDurationMs != null ? { targetDurationMs: envConfig.targetDurationMs } : {}),
    ...(envConfig.segmentDurationMs != null ? { segmentDurationMs: envConfig.segmentDurationMs } : {}),
    ...(envConfig.intervalMs != null ? { intervalMs: envConfig.intervalMs } : {}),
    ...(envConfig.iterationsPerCycle != null ? { iterationsPerCycle: envConfig.iterationsPerCycle } : {}),
    ...(envConfig.validationIterations != null ? { validationIterations: envConfig.validationIterations } : {}),
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.finalEvidenceReport && !report.finalEvidenceReport.summary.passed
    ? CLI_EXIT_FAILURE
    : CLI_EXIT_SUCCESS;
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCliMain(main, {
    onError: (err) => {
      process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    },
  });
}
