import { runStableRollingUpgradeRehearsal, writeStableRollingUpgradeRehearsalReport, } from "../../platform/shared/stability/stable-rolling-upgrade-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";
createStableCli({
    envVar: "AA_STABLE_UPGRADE",
    defaultDir: "data/stable-upgrade",
    reportFilename: "stable-rolling-upgrade-report.json",
    runner: runStableRollingUpgradeRehearsal,
    writer: writeStableRollingUpgradeRehearsalReport,
});
//# sourceMappingURL=stable-upgrade.js.map