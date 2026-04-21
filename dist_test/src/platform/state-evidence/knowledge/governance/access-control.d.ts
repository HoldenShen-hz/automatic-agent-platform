import type { KnowledgeNamespace } from "../knowledge-model.js";
export type KnowledgeAccessAction = "read" | "write" | "admin";
export type KnowledgeAccessRole = "reader" | "writer" | "admin" | "cross_domain_reader";
export interface KnowledgeAccessPrincipal {
    principalId: string;
    domainId: string | null;
    roles: KnowledgeAccessRole[];
    permittedNamespaces?: string[];
}
export interface KnowledgeAccessDecision {
    allowed: boolean;
    action: KnowledgeAccessAction;
    principalId: string | null;
    principalDomainId: string | null;
    namespace: string;
    ownerDomainId: string;
    crossDomain: boolean;
    reasonCode: string;
}
export declare class KnowledgeAccessControl {
    canRead(namespace: KnowledgeNamespace, domainId: string | null): boolean;
    checkAccess(namespace: KnowledgeNamespace, input: {
        action: KnowledgeAccessAction;
        principal?: KnowledgeAccessPrincipal | null;
    }): KnowledgeAccessDecision;
    private buildDecision;
}
