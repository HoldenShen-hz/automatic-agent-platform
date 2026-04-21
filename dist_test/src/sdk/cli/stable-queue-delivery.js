import { runStableQueueDeliveryRehearsal, writeStableQueueDeliveryRehearsalReport, } from "../../platform/shared/stability/stable-queue-delivery-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";
createStableCli({
    envVar: "AA_STABLE_QUEUE_DELIVERY",
    defaultDir: "data/stable-queue-delivery",
    reportFilename: "stable-queue-delivery-report.json",
    runner: runStableQueueDeliveryRehearsal,
    writer: writeStableQueueDeliveryRehearsalReport,
});
//# sourceMappingURL=stable-queue-delivery.js.map