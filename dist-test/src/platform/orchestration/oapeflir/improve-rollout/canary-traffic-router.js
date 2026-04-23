const TRAFFIC_PERCENTAGES = {
    draft: 0,
    pending_approval: 0,
    shadow: 0,
    canary_5: 5,
    partial_25: 25,
    partial_50: 50,
    partial_75: 75,
    stable: 100,
    rejected: 0,
    rolled_back: 0,
    paused: 0,
};
function hashToBucket(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
    }
    return hash % 100;
}
export class CanaryTrafficRouter {
    getTrafficPercentage(status) {
        return TRAFFIC_PERCENTAGES[status] ?? 0;
    }
    shouldRoute(taskId, status) {
        return this.route(taskId, status).matched;
    }
    route(taskId, status) {
        const trafficPercentage = this.getTrafficPercentage(status);
        const bucket = hashToBucket(taskId);
        return {
            matched: bucket < trafficPercentage,
            trafficPercentage,
            bucket,
        };
    }
}
//# sourceMappingURL=canary-traffic-router.js.map