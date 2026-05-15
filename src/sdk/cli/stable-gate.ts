import {
  buildStableReleaseGateReport,
  writeStableReleaseGateReport,
} from "../../platform/shared/stability/stable-release-gate.js";
import { loadStableGateCliEnv } from "../../platform/five-plane-control-plane/config-center/stable-cli-env.js";
import { createStableCli } from "./stable-runner-factory.js";

createStableCli({
  envVar: "AA_STABLE_GATE",
  defaultDir: "data/stable-gate",
  reportFilename: "stable-release-gate-report.json",
  runner: buildStableReleaseGateReport,
  writer: writeStableReleaseGateReport,
  failed: (report) => report.overallVerdict === "promote_blocked",
  prepare: () => {
    const envConfig = loadStableGateCliEnv();
    return {
      outputDir: envConfig.outputDir,
      ...(envConfig.evidenceRootDir != null ? { evidenceRootDir: envConfig.evidenceRootDir } : {}),
      targetStatus: envConfig.targetStatus,
    };
  },
});
