import { runStableWorkerHandshakeRehearsal, writeStableWorkerHandshakeRehearsalReport, } from "../../platform/shared/stability/stable-worker-handshake-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";
createStableCli({
    envVar: "AA_STABLE_WORKER_HANDSHAKE",
    defaultDir: "data/stable-worker-handshake",
    reportFilename: "stable-worker-handshake-report.json",
    runner: runStableWorkerHandshakeRehearsal,
    writer: writeStableWorkerHandshakeRehearsalReport,
});
//# sourceMappingURL=stable-worker-handshake.js.map