import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";
import type { QueueDTO } from "@aa/shared-types";

export function createQueuesMobileCards(queues: readonly QueueDTO[]) {
  return queues.slice(0, 3).map((queue) => createMobileFeatureCard(
    queue.id,
    translateMessage("ui.queues.mobile.ready", { ready: queue.ready, inFlight: queue.inFlight }),
    translateMessage("ui.queues.mobile.dlq", { count: queue.dlq }),
  ));
}
