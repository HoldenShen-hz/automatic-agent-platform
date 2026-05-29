import { useQueuesQuery } from "@aa/shared-state";
export function mapQueuesToVm(queues) {
    return {
        metrics: [
            { label: "Ready", value: queues.reduce((total, queue) => total + queue.ready, 0) },
            { label: "In Flight", value: queues.reduce((total, queue) => total + queue.inFlight, 0) },
            { label: "Retries", value: queues.reduce((total, queue) => total + queue.retries, 0) },
            { label: "DLQ", value: queues.reduce((total, queue) => total + queue.dlq, 0) },
        ],
    };
}
export function useQueuesVm() {
    return mapQueuesToVm(useQueuesQuery().data ?? []);
}
