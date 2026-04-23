export function detectSlaBreach(observation, commitment) {
    const breaches = [];
    if (observation.latencyMs > commitment.maxLatencyMs)
        breaches.push("sla.latency_breach");
    if (observation.successRate < commitment.minSuccessRate)
        breaches.push("sla.success_rate_breach");
    if (observation.queueWaitMs > commitment.maxQueueWaitMs)
        breaches.push("sla.queue_wait_breach");
    return breaches;
}
//# sourceMappingURL=index.js.map