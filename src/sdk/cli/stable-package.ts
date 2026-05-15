import {
  createStableReleasePackage,
} from "../../platform/shared/stability/stable-release-package.js";
import { loadStablePackageCliEnv } from "../../platform/five-plane-control-plane/config-center/stable-cli-env.js";
import { createStableCli } from "./stable-runner-factory.js";

createStableCli({
  envVar: "AA_STABLE_PACKAGE",
  defaultDir: "data/stable-package",
  runner: createStableReleasePackage,
  failed: (report) => report.overallVerdict === "promote_blocked",
  prepare: () => {
    const envConfig = loadStablePackageCliEnv();
    return {
      outputDir: envConfig.outputDir,
      ...(envConfig.evidenceRootDir != null ? { evidenceRootDir: envConfig.evidenceRootDir } : {}),
      targetStatus: envConfig.targetStatus,
    };
  },
});
