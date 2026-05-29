import { fetchAgents, fetchIncidents, fetchMissions, fetchQueues, fetchWorkers, } from "@aa/shared-api-client";
import { createReadonlyQuery } from "./helpers";
export const missionControlQueryKeys = {
    incidents: ["incidents"],
    workers: ["workers"],
    queues: ["queues"],
    agents: ["agents"],
    missions: ["missions"],
};
export function createIncidentsQuery(client) {
    return createReadonlyQuery(missionControlQueryKeys.incidents, () => fetchIncidents(client));
}
export function createWorkersQuery(client) {
    return createReadonlyQuery(missionControlQueryKeys.workers, () => fetchWorkers(client));
}
export function createQueuesQuery(client) {
    return createReadonlyQuery(missionControlQueryKeys.queues, () => fetchQueues(client));
}
export function createAgentsQuery(client) {
    return createReadonlyQuery(missionControlQueryKeys.agents, () => fetchAgents(client));
}
export function createMissionsQuery(client) {
    return createReadonlyQuery(missionControlQueryKeys.missions, () => fetchMissions(client));
}
