import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createWorkersMobileCards(workers) {
    return workers.slice(0, 3).map((worker) => createMobileFeatureCard(worker.id, `${worker.status} · ${worker.queue}`, `${worker.heartbeatLagMs}ms`));
}
