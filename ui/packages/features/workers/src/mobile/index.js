import { createMobileFeatureCard } from "@aa/ui-mobile";
function createWorkersMobileCards(workers) {
  return workers.slice(0, 3).map((worker) => createMobileFeatureCard(
    worker.id,
    `${worker.status} \xB7 ${worker.queue}`,
    worker.status === "offline" ? "n/a" : `${worker.heartbeatLagMs}ms`
  ));
}
export {
  createWorkersMobileCards
};
