export class KnowledgeAccessControl {
    canRead(namespace, domainId) {
        return this.checkAccess(namespace, {
            action: "read",
            principal: {
                principalId: domainId ?? "anonymous",
                domainId,
                roles: domainId === namespace.ownerDomainId ? ["reader"] : [],
            },
        }).allowed;
    }
    checkAccess(namespace, input) {
        const principal = input.principal ?? null;
        const principalDomainId = principal?.domainId ?? null;
        const sameDomain = principalDomainId != null && principalDomainId === namespace.ownerDomainId;
        const crossDomain = principalDomainId != null && principalDomainId !== namespace.ownerDomainId;
        const explicitlyPermitted = principal?.permittedNamespaces?.includes(namespace.path) ?? false;
        const roleSet = new Set(principal?.roles ?? []);
        if (explicitlyPermitted || roleSet.has("admin")) {
            return this.buildDecision(namespace, input.action, principal, true, crossDomain ? "knowledge.access.explicit_override" : "knowledge.access.admin");
        }
        if (input.action === "read" && namespace.accessPolicy === "public") {
            return this.buildDecision(namespace, input.action, principal, true, "knowledge.access.public");
        }
        if (sameDomain && input.action === "read" && roleSet.has("reader")) {
            return this.buildDecision(namespace, input.action, principal, true, "knowledge.access.domain_read");
        }
        if (sameDomain && input.action === "write" && roleSet.has("writer")) {
            return this.buildDecision(namespace, input.action, principal, true, "knowledge.access.domain_write");
        }
        if (crossDomain && input.action === "read" && roleSet.has("cross_domain_reader")) {
            return this.buildDecision(namespace, input.action, principal, true, "knowledge.access.cross_domain_reader");
        }
        return this.buildDecision(namespace, input.action, principal, false, crossDomain
            ? "knowledge.access.cross_domain_denied"
            : namespace.accessPolicy === "public"
                ? "knowledge.access.privilege_required"
                : "knowledge.access.same_domain_privilege_required");
    }
    buildDecision(namespace, action, principal, allowed, reasonCode) {
        return {
            allowed,
            action,
            principalId: principal?.principalId ?? null,
            principalDomainId: principal?.domainId ?? null,
            namespace: namespace.path,
            ownerDomainId: namespace.ownerDomainId,
            crossDomain: principal?.domainId != null && principal.domainId !== namespace.ownerDomainId,
            reasonCode,
        };
    }
}
//# sourceMappingURL=access-control.js.map