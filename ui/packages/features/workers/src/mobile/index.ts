import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { WorkerDTO } from "@aa/shared-types";

export function createWorkersMobileCards(workers: readonly WorkerDTO[]) {
  return workers.slice(0, 3).map((worker) => createMobileFeatureCard(
    worker.id,
    `${worker.status} · ${worker.queue}`,
    `${worker.heartbeatLagMs}ms`,
  ));
}
