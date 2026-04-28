import { listPlatformApps, type PlatformAppManifest } from "../../../apps/index.js";
import { buildOpenApiDocument, listApiRoutes, type ApiRouteSpec } from "./openapi-document.js";

export type ApiResourceVisibility = "public" | "authenticated" | "admin";

export interface ApiResourceDescriptor {
  resourceId: string;
  method: ApiRouteSpec["method"];
  path: string;
  summary: string;
  tags: string[];
  version: string | null;
  plane: string;
  visibility: ApiResourceVisibility;
  exposedByApps: PlatformAppManifest["kind"][];
}

export interface ApiCatalogSummary {
  totalResources: number;
  publicResources: number;
  authenticatedResources: number;
  adminResources: number;
  versionedResources: number;
  unversionedResources: number;
  byPlane: Record<string, number>;
}

export class ApiResourceCatalogService {
  public listResources(filters: {
    tag?: string;
    visibility?: ApiResourceVisibility;
    version?: string | null;
  } = {}): ApiResourceDescriptor[] {
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

  public buildSummary(): ApiCatalogSummary {
    const resources = this.listResources();
    return {
      totalResources: resources.length,
      publicResources: resources.filter((resource) => resource.visibility === "public").length,
      authenticatedResources: resources.filter((resource) => resource.visibility === "authenticated").length,
      adminResources: resources.filter((resource) => resource.visibility === "admin").length,
      versionedResources: resources.filter((resource) => resource.version != null).length,
      unversionedResources: resources.filter((resource) => resource.version == null).length,
      byPlane: resources.reduce<Record<string, number>>((summary, resource) => {
        summary[resource.plane] = (summary[resource.plane] ?? 0) + 1;
        return summary;
      }, {}),
    };
  }

  public buildContractCoverage(): Array<{
    path: string;
    methods: string[];
    documented: boolean;
    tags: string[];
  }> {
    const document = buildOpenApiDocument() as { paths: Record<string, Record<string, { tags?: string[] }>> };
    return Object.entries(document.paths).map(([path, methods]) => ({
      path,
      methods: Object.keys(methods),
      documented: true,
      tags: Object.values(methods).flatMap((spec) => spec.tags ?? []),
    }));
  }

  private toDescriptor(route: ApiRouteSpec): ApiResourceDescriptor {
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

function extractVersion(path: string): string | null {
  const match = path.match(/^\/(v\d+)(?:\/|$)/);
  return match?.[1] ?? null;
}

function inferPlane(route: ApiRouteSpec): string {
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

function inferVisibility(route: ApiRouteSpec): ApiResourceVisibility {
  if (
    route.path.startsWith("/health")
    || route.path === "/metrics"
    || route.path === "/prometheus"
    || route.path === "/v1/openapi.json"
    || route.path === "/v1/auth/token"
    || route.path === "/v1/webhooks/{endpointId}/receive"
  ) {
    return "public";
  }
  if (route.tags.includes("admin")) {
    return "admin";
  }
  return "authenticated";
}

function inferExposedApps(route: ApiRouteSpec): PlatformAppManifest["kind"][] {
  const apps = new Set<PlatformAppManifest["kind"]>(["api"]);
  if (route.tags.some((tag) => tag === "dashboard" || tag === "approvals" || tag === "admin")) {
    apps.add("console");
  }
  return listPlatformApps()
    .map((app) => app.kind)
    .filter((kind) => apps.has(kind));
}
