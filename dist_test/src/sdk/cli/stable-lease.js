import { runStableLeaseRehearsal, writeStableLeaseRehearsalReport, } from "../../platform/shared/stability/stable-lease-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";
createStableCli({
    envVar: "AA_STABLE_LEASE",
    defaultDir: "data/stable-lease",
    reportFilename: "stable-lease-report.json",
    runner: runStableLeaseRehearsal,
    writer: writeStableLeaseRehearsalReport,
});
//# sourceMappingURL=stable-lease.js.map