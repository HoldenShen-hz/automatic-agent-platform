import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createQueuesMobileCards(queues) {
    return queues.slice(0, 3).map((queue) => createMobileFeatureCard(queue.id, `ready ${queue.ready} · in-flight ${queue.inFlight}`, `dlq ${queue.dlq}`));
}
