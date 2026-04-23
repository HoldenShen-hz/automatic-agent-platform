import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { type DomainBaseline } from "./domains/domains-bootstrap.js";
export declare const DOMAINS_RUNTIME_CATALOG_SERVICE_ID = "w5.runtime.catalog";
export interface DomainsRuntimeCatalog {
    readonly phase9a: readonly DomainBaseline[];
    readonly phase9b: readonly DomainBaseline[];
    readonly phase9c: readonly DomainBaseline[];
    readonly phase9d: readonly DomainBaseline[];
    readonly phase9e: readonly DomainBaseline[];
    readonly phase9f: readonly DomainBaseline[];
}
export declare function buildDomainsRuntimeCatalog(): DomainsRuntimeCatalog;
export declare function registerDomainsRuntimeCatalog(registry?: ServiceRegistry): DomainsRuntimeCatalog;
