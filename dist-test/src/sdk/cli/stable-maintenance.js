import { runStableMaintenanceRehearsal, writeStableMaintenanceRehearsalReport, } from "../../platform/shared/stability/stable-maintenance-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";
createStableCli({
    envVar: "AA_STABLE_MAINTENANCE",
    defaultDir: "data/stable-maintenance",
    reportFilename: "stable-maintenance-report.json",
    runner: runStableMaintenanceRehearsal,
    writer: writeStableMaintenanceRehearsalReport,
});
//# sourceMappingURL=stable-maintenance.js.map