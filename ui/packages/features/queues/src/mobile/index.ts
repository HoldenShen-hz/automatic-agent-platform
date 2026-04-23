import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { QueueDTO } from "@aa/shared-types";

export function createQueuesMobileCards(queues: readonly QueueDTO[]) {
  return queues.slice(0, 3).map((queue) => createMobileFeatureCard(
    queue.id,
    `ready ${queue.ready} · in-flight ${queue.inFlight}`,
    `dlq ${queue.dlq}`,
  ));
}
