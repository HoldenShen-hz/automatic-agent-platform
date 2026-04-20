import { newId } from "../../platform/contracts/types/ids.js";
import { buildOidcAuthorizationUrl, type OidcProviderConfig } from "./oidc/index.js";
import { buildSamlAudience, type SamlProviderConfig } from "./saml/index.js";
import { isTerminalScimAction, type ScimProvisioningEvent } from "./scim-sync/index.js";

export interface IdentitySyncSnapshot {
  readonly oidcAuthorizationUrl: string;
  readonly samlAudience: string;
  readonly appliedScimEvents: readonly {
    readonly eventId: string;
    readonly terminal: boolean;
  }[];
  readonly activeSubjects: readonly string[];
}

export class IdentitySyncService {
  private readonly activeSubjects = new Set<string>();

  public bootstrap(
    oidc: OidcProviderConfig,
    saml: SamlProviderConfig,
    events: readonly ScimProvisioningEvent[],
  ): IdentitySyncSnapshot {
    for (const event of events) {
      if (isTerminalScimAction(event.action)) {
        this.activeSubjects.delete(event.subjectId);
      } else {
        this.activeSubjects.add(event.subjectId);
      }
    }

    return {
      oidcAuthorizationUrl: buildOidcAuthorizationUrl(oidc, newId("oidc_state")),
      samlAudience: buildSamlAudience(saml),
      appliedScimEvents: events.map((event) => ({
        eventId: event.eventId,
        terminal: isTerminalScimAction(event.action),
      })),
      activeSubjects: [...this.activeSubjects].sort(),
    };
  }
}
