import { runStableWorkerWritebackRehearsal, writeStableWorkerWritebackRehearsalReport, } from "../../platform/shared/stability/stable-worker-writeback-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";
createStableCli({
    envVar: "AA_STABLE_WORKER_WRITEBACK",
    defaultDir: "data/stable-worker-writeback",
    reportFilename: "stable-worker-writeback-report.json",
    runner: runStableWorkerWritebackRehearsal,
    writer: writeStableWorkerWritebackRehearsalReport,
});
//# sourceMappingURL=stable-worker-writeback.js.map