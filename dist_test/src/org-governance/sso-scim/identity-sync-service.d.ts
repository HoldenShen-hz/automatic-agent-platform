import { type OidcProviderConfig } from "./oidc/index.js";
import { type SamlProviderConfig } from "./saml/index.js";
import { type ScimProvisioningEvent } from "./scim-sync/index.js";
export interface IdentitySyncSnapshot {
    readonly oidcAuthorizationUrl: string;
    readonly samlAudience: string;
    readonly appliedScimEvents: readonly {
        readonly eventId: string;
        readonly terminal: boolean;
    }[];
    readonly activeSubjects: readonly string[];
}
export declare class IdentitySyncService {
    private readonly activeSubjects;
    bootstrap(oidc: OidcProviderConfig, saml: SamlProviderConfig, events: readonly ScimProvisioningEvent[]): IdentitySyncSnapshot;
}
