import { runStableChaosSmoke, writeStableChaosSmokeReport, } from "../../platform/shared/stability/stable-chaos-smoke.js";
import { createStableCli } from "./stable-runner-factory.js";
createStableCli({
    envVar: "AA_STABLE_CHAOS",
    defaultDir: "data/stable-chaos",
    reportFilename: "stable-chaos-report.json",
    runner: runStableChaosSmoke,
    writer: writeStableChaosSmokeReport,
});
//# sourceMappingURL=stable-chaos.js.map