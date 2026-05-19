import { ApiAuthService } from "../../src/platform/five-plane-interface/api/api-auth-service.js";
import { ApprovalService } from "../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { HttpApiServer } from "../../src/platform/five-plane-interface/api/http-api-server.js";
import { MissionControlService } from "../../src/platform/five-plane-interface/api/mission-control-service.js";
import { GatewayTargetDirectoryService } from "../../src/platform/five-plane-interface/channel-gateway/gateway-target-directory-service.js";
import { InspectService } from "../../src/platform/shared/observability/inspect-service.js";
import { BillingService } from "../../src/scale-ecosystem/marketplace/billing-service.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { ArtifactPlaneService } from "../../src/platform/five-plane-state-evidence/artifacts/artifact-plane-service.js";
import { DomainRegistryService } from "../../src/domains/registry/domain-registry-service.js";
import { PluginSpiRegistry } from "../../src/domains/registry/plugin-spi-registry.js";
import { KnowledgePlaneService } from "../../src/platform/five-plane-state-evidence/knowledge/knowledge-plane-service.js";
export interface SeededApiContext {
    db: SqliteDatabase;
    store: AuthoritativeTaskStore;
    billingService: BillingService;
    approvalService: ApprovalService;
    authService: ApiAuthService;
    inspectService: InspectService;
    missionControlService: MissionControlService;
    gatewayTargetDirectoryService: GatewayTargetDirectoryService;
    knowledgePlaneService: KnowledgePlaneService;
    artifactPlaneService: ArtifactPlaneService;
    domainRegistryService: DomainRegistryService;
    pluginRegistry: PluginSpiRegistry;
    seededTaskId: string;
    approvalId: string;
    seededWorkerId: string;
    takeoverSessionId: string | null;
    createServer(): HttpApiServer;
}
export interface SeededApiContextOptions {
    tenantId?: string | null;
}
export declare function createSeededApiContext(workspace: string, options?: SeededApiContextOptions): SeededApiContext;
