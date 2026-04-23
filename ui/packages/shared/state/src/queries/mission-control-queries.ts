import {
  fetchAgents,
  fetchIncidents,
  fetchQueues,
  fetchWorkers,
  type RESTClient,
} from "@aa/shared-api-client";
import { createReadonlyQuery } from "./helpers";

export const missionControlQueryKeys = {
  incidents: ["incidents"] as const,
  workers: ["workers"] as const,
  queues: ["queues"] as const,
  agents: ["agents"] as const,
};

export function createIncidentsQuery(client: RESTClient) {
  return createReadonlyQuery(missionControlQueryKeys.incidents, () => fetchIncidents(client));
}

export function createWorkersQuery(client: RESTClient) {
  return createReadonlyQuery(missionControlQueryKeys.workers, () => fetchWorkers(client));
}

export function createQueuesQuery(client: RESTClient) {
  return createReadonlyQuery(missionControlQueryKeys.queues, () => fetchQueues(client));
}

export function createAgentsQuery(client: RESTClient) {
  return createReadonlyQuery(missionControlQueryKeys.agents, () => fetchAgents(client));
}
