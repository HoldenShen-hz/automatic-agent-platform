import { newId } from "../../platform/contracts/types/ids.js";
import { buildOidcAuthorizationUrl } from "./oidc/index.js";
import { buildSamlAudience } from "./saml/index.js";
import { isTerminalScimAction } from "./scim-sync/index.js";
export class IdentitySyncService {
    activeSubjects = new Set();
    bootstrap(oidc, saml, events) {
        for (const event of events) {
            if (isTerminalScimAction(event.action)) {
                this.activeSubjects.delete(event.subjectId);
            }
            else {
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
//# sourceMappingURL=identity-sync-service.js.map