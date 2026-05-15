import { loadStableValidateCliEnv } from "../../platform/five-plane-control-plane/config-center/stable-cli-env.js";
import { runStableValidation } from "../../platform/shared/stability/stable-runtime-validator.js";
import { createStableCli } from "./stable-runner-factory.js";

createStableCli({
  envVar: "AA_VALIDATION",
  defaultDir: "data/validation",
  runner: runStableValidation,
  failed: (report) =>
    report.failedRuns > 0 || report.integrityFailures > 0 || report.backupFailures > 0,
  prepare: () => loadStableValidateCliEnv(),
});
