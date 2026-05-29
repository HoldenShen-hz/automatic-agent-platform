import { type RESTClient } from "@aa/shared-api-client";
export declare const missionControlQueryKeys: {
    incidents: readonly ["incidents"];
    workers: readonly ["workers"];
    queues: readonly ["queues"];
    agents: readonly ["agents"];
    missions: readonly ["missions"];
};
export declare function createIncidentsQuery(client: RESTClient): {
    queryKey: readonly ["incidents"];
    queryFn: import("@tanstack/query-core").QueryFunction<readonly import("@aa/shared-types").IncidentDTO[], readonly ["incidents"]>;
};
export declare function createWorkersQuery(client: RESTClient): {
    queryKey: readonly ["workers"];
    queryFn: import("@tanstack/query-core").QueryFunction<readonly import("@aa/shared-types").WorkerDTO[], readonly ["workers"]>;
};
export declare function createQueuesQuery(client: RESTClient): {
    queryKey: readonly ["queues"];
    queryFn: import("@tanstack/query-core").QueryFunction<readonly import("@aa/shared-types").QueueDTO[], readonly ["queues"]>;
};
export declare function createAgentsQuery(client: RESTClient): {
    queryKey: readonly ["agents"];
    queryFn: import("@tanstack/query-core").QueryFunction<readonly import("@aa/shared-types").AgentDTO[], readonly ["agents"]>;
};
export declare function createMissionsQuery(client: RESTClient): {
    queryKey: readonly ["missions"];
    queryFn: import("@tanstack/query-core").QueryFunction<readonly import("@aa/shared-types").MissionDTO[], readonly ["missions"]>;
};
