import { loadStableSoakCliEnv } from "../../platform/control-plane/config-center/stable-cli-env.js";
import { runStableSoak, writeStableSoakReport, } from "../../platform/shared/stability/stable-runtime-soak-runner.js";
import { createStableCli } from "./stable-runner-factory.js";
createStableCli({
    envVar: "AA_SOAK",
    defaultDir: "data/soak",
    reportFilename: "stable-soak-report.json",
    runner: runStableSoak,
    writer: writeStableSoakReport,
    failed: (report) => report.failedRuns > 0 || report.integrityFailures > 0 || report.backupFailures > 0,
    prepare: () => loadStableSoakCliEnv(),
});
//# sourceMappingURL=stable-soak.js.map