import { type IncomingMessage, type Server, type ServerResponse } from "node:http";
export declare function createMockServerSnapshot(): import("@aa/shared-api-client").MockApiShape;
export declare function describePlannedEndpoint(id: string): {
    id: string;
    enabled: boolean;
    reason: string;
};
export declare function resolveMockRequest(path: string): import("@aa/shared-types").DashboardSnapshotDTO | readonly import("@aa/shared-types").TaskDTO[] | readonly import("@aa/shared-types").WorkflowDTO[] | readonly import("@aa/shared-types").ApprovalDTO[] | {
    accepted: boolean;
    apiVersion: string;
    platformVersion: string;
    contractVersion: "2026-04-01";
    minServerVersion: "2026-04-01";
    supportedVersions: ("2026-04-01" | "2026-01-01")[];
    ok?: never;
    path?: never;
} | {
    ok: boolean;
    path: string;
    accepted?: never;
    apiVersion?: never;
    platformVersion?: never;
    contractVersion?: never;
    minServerVersion?: never;
    supportedVersions?: never;
};
export interface MockHttpServer {
    readonly server: Server;
    readonly port: number;
    readonly url: string;
    close(): Promise<void>;
}
export declare function createMockRequestHandler(): (request: IncomingMessage, response: ServerResponse) => void;
export declare function createMockHttpServer(port?: number): Promise<MockHttpServer>;
