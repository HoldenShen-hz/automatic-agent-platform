import { listPlatformApps } from "../../../apps/index.js";
import { buildOpenApiDocument, listApiRoutes } from "./openapi-document.js";
export class ApiResourceCatalogService {
    listResources(filters = {}) {
        return listApiRoutes()
            .map((route) => this.toDescriptor(route))
            .filter((resource) => {
            if (filters.tag != null && !resource.tags.includes(filters.tag)) {
                return false;
            }
            if (filters.visibility != null && resource.visibility !== filters.visibility) {
                return false;
            }
            if (filters.version !== undefined && resource.version !== filters.version) {
                return false;
            }
            return true;
        });
    }
    buildSummary() {
        const resources = this.listResources();
        return {
            totalResources: resources.length,
            publicResources: resources.filter((resource) => resource.visibility === "public").length,
            authenticatedResources: resources.filter((resource) => resource.visibility === "authenticated").length,
            adminResources: resources.filter((resource) => resource.visibility === "admin").length,
            versionedResources: resources.filter((resource) => resource.version != null).length,
            unversionedResources: resources.filter((resource) => resource.version == null).length,
            byPlane: resources.reduce((summary, resource) => {
                summary[resource.plane] = (summary[resource.plane] ?? 0) + 1;
                return summary;
            }, {}),
        };
    }
    buildContractCoverage() {
        const document = buildOpenApiDocument();
        return Object.entries(document.paths).map(([path, methods]) => ({
            path,
            methods: Object.keys(methods),
            documented: true,
            tags: Object.values(methods).flatMap((spec) => spec.tags ?? []),
        }));
    }
    toDescriptor(route) {
        return {
            resourceId: `${route.method}:${route.path}`,
            method: route.method,
            path: route.path,
            summary: route.summary,
            tags: route.tags,
            version: extractVersion(route.path),
            plane: inferPlane(route),
            visibility: inferVisibility(route),
            exposedByApps: inferExposedApps(route),
        };
    }
}
function extractVersion(path) {
    const match = path.match(/^\/(v\d+)(?:\/|$)/);
    return match?.[1] ?? null;
}
function inferPlane(route) {
    if (route.tags.includes("admin")) {
        return "control_plane";
    }
    if (route.tags.includes("gateway")) {
        return "interaction_plane";
    }
    if (route.tags.includes("knowledge") || route.tags.includes("artifacts")) {
        return "data_plane";
    }
    if (route.tags.includes("tasks") || route.tags.includes("approvals")) {
        return "execution_plane";
    }
    return "platform_meta";
}
function inferVisibility(route) {
    if (route.path.startsWith("/health") || route.path === "/metrics" || route.path === "/prometheus" || route.path === "/v1/openapi.json" || route.path === "/v1/auth/token") {
        return "public";
    }
    if (route.tags.includes("admin")) {
        return "admin";
    }
    return "authenticated";
}
function inferExposedApps(route) {
    const apps = new Set(["api"]);
    if (route.tags.some((tag) => tag === "dashboard" || tag === "approvals" || tag === "admin")) {
        apps.add("console");
    }
    return listPlatformApps()
        .map((app) => app.kind)
        .filter((kind) => apps.has(kind));
}
//# sourceMappingURL=api-resource-catalog-service.js.map