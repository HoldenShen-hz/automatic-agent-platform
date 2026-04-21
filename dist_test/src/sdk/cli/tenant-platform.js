// Tenant Platform CLI Entry Point
// Manages multi-tenant hierarchy: workspaces, organizations, tenants, deployments, and namespaces.
// Provides topology summary for understanding the tenant structure.
import { withCliStorage } from "./authoritative-storage.js";
import { loadTenantPlatformCliEnv } from "../../platform/control-plane/config-center/remaining-cli-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { TenantPlatformService } from "../../scale-ecosystem/marketplace/tenant-platform-service.js";
const envConfig = loadTenantPlatformCliEnv();
const result = withCliStorage((storage) => {
    const service = new TenantPlatformService(storage.sql, storage.store);
    switch (envConfig.action) {
        case "create_workspace":
            return service.createWorkspace({
                ownerId: envConfig.ownerId ?? "",
                displayName: envConfig.displayName ?? "",
                planId: envConfig.planId ?? "",
                ...(envConfig.workspaceId ? { workspaceId: envConfig.workspaceId } : {}),
                ...(envConfig.defaultPolicySet ? { defaultPolicySet: envConfig.defaultPolicySet } : {}),
                organizationId: envConfig.organizationId,
            });
        case "add_workspace_member":
            return service.addWorkspaceMembership({
                workspaceId: envConfig.workspaceId ?? "",
                userId: envConfig.userId ?? "",
                role: envConfig.role ?? "",
            });
        case "create_organization":
            return service.createOrganization({
                displayName: envConfig.displayName ?? "",
                ...(envConfig.organizationId ? { organizationId: envConfig.organizationId } : {}),
                billingAccountId: envConfig.billingAccountId,
                defaultTenantId: envConfig.tenantId,
            });
        case "add_organization_member":
            return service.addOrganizationMembership({
                organizationId: envConfig.organizationId ?? "",
                userId: envConfig.userId ?? "",
                role: envConfig.role ?? "",
            });
        case "create_tenant":
            return service.createTenant({
                organizationId: envConfig.organizationId ?? "",
                storageScope: envConfig.storageScope ?? "",
                identityScope: envConfig.identityScope ?? "",
                policyScope: envConfig.policyScope ?? "",
                artifactScope: envConfig.artifactScope ?? "",
                ...(envConfig.tenantId ? { tenantId: envConfig.tenantId } : {}),
                ...(envConfig.isolationMode ? { isolationMode: envConfig.isolationMode } : {}),
                ...(envConfig.deploymentMode ? { deploymentMode: envConfig.deploymentMode } : {}),
                setAsOrganizationDefault: envConfig.setAsOrganizationDefault,
            });
        case "bind_deployment":
            return service.createDeploymentBinding({
                tenantId: envConfig.tenantId ?? "",
                environmentId: envConfig.environmentId ?? "",
                deploymentMode: envConfig.deploymentMode ?? "cloud_shared",
                region: envConfig.region ?? "",
                networkBoundary: envConfig.networkBoundary ?? "",
                ...(envConfig.bindingId ? { bindingId: envConfig.bindingId } : {}),
            });
        case "create_namespace":
            return service.createDataNamespace({
                plane: envConfig.plane ?? "transactional",
                ...(envConfig.namespaceId ? { namespaceId: envConfig.namespaceId } : {}),
                tenantId: envConfig.tenantId,
                organizationId: envConfig.organizationId,
                workspaceId: envConfig.workspaceId,
                retentionPolicy: envConfig.retentionPolicy ?? "",
                encryptionPolicy: envConfig.encryptionPolicy ?? "",
                residencyPolicy: envConfig.residencyPolicy,
            });
        case "topology":
            return service.buildTopologySummary();
        default:
            throw new ValidationError(`unknown_tenant_action:${envConfig.action}`, `unknown_tenant_action:${envConfig.action}`);
    }
}, { dbPath: envConfig.dbPath });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
//# sourceMappingURL=tenant-platform.js.map