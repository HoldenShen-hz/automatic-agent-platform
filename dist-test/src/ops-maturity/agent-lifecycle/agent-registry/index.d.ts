import { z } from "zod";
/**
 * Agent lifecycle states as defined in architecture doc §61.3.
 */
export declare const AgentLifecycleStateSchema: z.ZodEnum<["draft", "testing", "staging", "canary", "active", "paused", "deprecated", "archived"]>;
export type AgentLifecycleState = z.infer<typeof AgentLifecycleStateSchema>;
/**
 * Agent component: Pack reference with version.
 * As defined in architecture doc §61.1.
 */
export declare const PackComponentSchema: z.ZodObject<{
    packId: z.ZodString;
    version: z.ZodString;
}, "strip", z.ZodTypeAny, {
    version: string;
    packId: string;
}, {
    version: string;
    packId: string;
}>;
/**
 * Agent component: Prompt Bundle reference with version.
 * As defined in architecture doc §61.1.
 */
export declare const PromptBundleComponentSchema: z.ZodObject<{
    bundleId: z.ZodString;
    version: z.ZodString;
}, "strip", z.ZodTypeAny, {
    version: string;
    bundleId: string;
}, {
    version: string;
    bundleId: string;
}>;
/**
 * Agent component: Model binding with fallback chain.
 * As defined in architecture doc §61.1.
 */
export declare const ModelBindingComponentSchema: z.ZodObject<{
    provider: z.ZodString;
    model: z.ZodString;
    fallbackChain: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    provider: string;
    model: string;
    fallbackChain: string[];
}, {
    provider: string;
    model: string;
    fallbackChain?: string[] | undefined;
}>;
/**
 * Agent component: Trust profile for autonomy scoring.
 * As defined in architecture doc §61.1.
 */
export declare const TrustProfileComponentSchema: z.ZodObject<{
    initialLevel: z.ZodDefault<z.ZodEnum<["suggestion", "supervised", "semi_auto", "full_auto"]>>;
    scoringConfig: z.ZodDefault<z.ZodObject<{
        successWeight: z.ZodDefault<z.ZodNumber>;
        latencyWeight: z.ZodDefault<z.ZodNumber>;
        errorWeight: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        successWeight: number;
        latencyWeight: number;
        errorWeight: number;
    }, {
        successWeight?: number | undefined;
        latencyWeight?: number | undefined;
        errorWeight?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    initialLevel: "supervised" | "full_auto" | "suggestion" | "semi_auto";
    scoringConfig: {
        successWeight: number;
        latencyWeight: number;
        errorWeight: number;
    };
}, {
    initialLevel?: "supervised" | "full_auto" | "suggestion" | "semi_auto" | undefined;
    scoringConfig?: {
        successWeight?: number | undefined;
        latencyWeight?: number | undefined;
        errorWeight?: number | undefined;
    } | undefined;
}>;
/**
 * Agent component: Trigger policy for proactive agents.
 * As defined in architecture doc §41.
 */
export declare const TriggerPolicySchema: z.ZodObject<{
    triggerId: z.ZodString;
    type: z.ZodDefault<z.ZodEnum<["scheduled", "event", "manual"]>>;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    type: "manual" | "scheduled" | "event";
    triggerId: string;
}, {
    triggerId: string;
    enabled?: boolean | undefined;
    type?: "manual" | "scheduled" | "event" | undefined;
}>;
/**
 * Agent component: Autonomy configuration.
 * As defined in architecture doc §42.
 */
export declare const AutonomyConfigSchema: z.ZodObject<{
    maxAutomationLevel: z.ZodDefault<z.ZodEnum<["suggestion", "supervised", "semi_auto", "full_auto"]>>;
    requireHumanApprovalForHighRisk: z.ZodDefault<z.ZodBoolean>;
    maxRetriesBeforeApproval: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    maxAutomationLevel: "supervised" | "full_auto" | "suggestion" | "semi_auto";
    requireHumanApprovalForHighRisk: boolean;
    maxRetriesBeforeApproval: number;
}, {
    maxAutomationLevel?: "supervised" | "full_auto" | "suggestion" | "semi_auto" | undefined;
    requireHumanApprovalForHighRisk?: boolean | undefined;
    maxRetriesBeforeApproval?: number | undefined;
}>;
/**
 * Agent components composite.
 * As defined in architecture doc §61.1.
 */
export declare const AgentComponentsSchema: z.ZodObject<{
    pack: z.ZodObject<{
        packId: z.ZodString;
        version: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        version: string;
        packId: string;
    }, {
        version: string;
        packId: string;
    }>;
    promptBundle: z.ZodObject<{
        bundleId: z.ZodString;
        version: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        version: string;
        bundleId: string;
    }, {
        version: string;
        bundleId: string;
    }>;
    modelBinding: z.ZodObject<{
        provider: z.ZodString;
        model: z.ZodString;
        fallbackChain: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        provider: string;
        model: string;
        fallbackChain: string[];
    }, {
        provider: string;
        model: string;
        fallbackChain?: string[] | undefined;
    }>;
    trustProfile: z.ZodObject<{
        initialLevel: z.ZodDefault<z.ZodEnum<["suggestion", "supervised", "semi_auto", "full_auto"]>>;
        scoringConfig: z.ZodDefault<z.ZodObject<{
            successWeight: z.ZodDefault<z.ZodNumber>;
            latencyWeight: z.ZodDefault<z.ZodNumber>;
            errorWeight: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            successWeight: number;
            latencyWeight: number;
            errorWeight: number;
        }, {
            successWeight?: number | undefined;
            latencyWeight?: number | undefined;
            errorWeight?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        initialLevel: "supervised" | "full_auto" | "suggestion" | "semi_auto";
        scoringConfig: {
            successWeight: number;
            latencyWeight: number;
            errorWeight: number;
        };
    }, {
        initialLevel?: "supervised" | "full_auto" | "suggestion" | "semi_auto" | undefined;
        scoringConfig?: {
            successWeight?: number | undefined;
            latencyWeight?: number | undefined;
            errorWeight?: number | undefined;
        } | undefined;
    }>;
    triggerSet: z.ZodDefault<z.ZodArray<z.ZodObject<{
        triggerId: z.ZodString;
        type: z.ZodDefault<z.ZodEnum<["scheduled", "event", "manual"]>>;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        type: "manual" | "scheduled" | "event";
        triggerId: string;
    }, {
        triggerId: string;
        enabled?: boolean | undefined;
        type?: "manual" | "scheduled" | "event" | undefined;
    }>, "many">>;
    autonomyConfig: z.ZodObject<{
        maxAutomationLevel: z.ZodDefault<z.ZodEnum<["suggestion", "supervised", "semi_auto", "full_auto"]>>;
        requireHumanApprovalForHighRisk: z.ZodDefault<z.ZodBoolean>;
        maxRetriesBeforeApproval: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        maxAutomationLevel: "supervised" | "full_auto" | "suggestion" | "semi_auto";
        requireHumanApprovalForHighRisk: boolean;
        maxRetriesBeforeApproval: number;
    }, {
        maxAutomationLevel?: "supervised" | "full_auto" | "suggestion" | "semi_auto" | undefined;
        requireHumanApprovalForHighRisk?: boolean | undefined;
        maxRetriesBeforeApproval?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    pack: {
        version: string;
        packId: string;
    };
    promptBundle: {
        version: string;
        bundleId: string;
    };
    modelBinding: {
        provider: string;
        model: string;
        fallbackChain: string[];
    };
    trustProfile: {
        initialLevel: "supervised" | "full_auto" | "suggestion" | "semi_auto";
        scoringConfig: {
            successWeight: number;
            latencyWeight: number;
            errorWeight: number;
        };
    };
    triggerSet: {
        enabled: boolean;
        type: "manual" | "scheduled" | "event";
        triggerId: string;
    }[];
    autonomyConfig: {
        maxAutomationLevel: "supervised" | "full_auto" | "suggestion" | "semi_auto";
        requireHumanApprovalForHighRisk: boolean;
        maxRetriesBeforeApproval: number;
    };
}, {
    pack: {
        version: string;
        packId: string;
    };
    promptBundle: {
        version: string;
        bundleId: string;
    };
    modelBinding: {
        provider: string;
        model: string;
        fallbackChain?: string[] | undefined;
    };
    trustProfile: {
        initialLevel?: "supervised" | "full_auto" | "suggestion" | "semi_auto" | undefined;
        scoringConfig?: {
            successWeight?: number | undefined;
            latencyWeight?: number | undefined;
            errorWeight?: number | undefined;
        } | undefined;
    };
    autonomyConfig: {
        maxAutomationLevel?: "supervised" | "full_auto" | "suggestion" | "semi_auto" | undefined;
        requireHumanApprovalForHighRisk?: boolean | undefined;
        maxRetriesBeforeApproval?: number | undefined;
    };
    triggerSet?: {
        triggerId: string;
        enabled?: boolean | undefined;
        type?: "manual" | "scheduled" | "event" | undefined;
    }[] | undefined;
}>;
/**
 * OrgNode reference for ownership.
 * As defined in architecture doc §46.
 */
export declare const OrgNodeRefSchema: z.ZodObject<{
    orgNodeId: z.ZodString;
    path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
    orgNodeId: string;
}, {
    path: string;
    orgNodeId: string;
}>;
/**
 * Agent definition - composite entity as defined in architecture doc §61.1.
 * This is the primary entity for Agent lifecycle management.
 */
export declare const AgentDefinitionSchema: z.ZodObject<{
    agentId: z.ZodString;
    name: z.ZodString;
    domainId: z.ZodString;
    owner: z.ZodObject<{
        orgNodeId: z.ZodString;
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        orgNodeId: string;
    }, {
        path: string;
        orgNodeId: string;
    }>;
    components: z.ZodObject<{
        pack: z.ZodObject<{
            packId: z.ZodString;
            version: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            version: string;
            packId: string;
        }, {
            version: string;
            packId: string;
        }>;
        promptBundle: z.ZodObject<{
            bundleId: z.ZodString;
            version: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            version: string;
            bundleId: string;
        }, {
            version: string;
            bundleId: string;
        }>;
        modelBinding: z.ZodObject<{
            provider: z.ZodString;
            model: z.ZodString;
            fallbackChain: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            provider: string;
            model: string;
            fallbackChain: string[];
        }, {
            provider: string;
            model: string;
            fallbackChain?: string[] | undefined;
        }>;
        trustProfile: z.ZodObject<{
            initialLevel: z.ZodDefault<z.ZodEnum<["suggestion", "supervised", "semi_auto", "full_auto"]>>;
            scoringConfig: z.ZodDefault<z.ZodObject<{
                successWeight: z.ZodDefault<z.ZodNumber>;
                latencyWeight: z.ZodDefault<z.ZodNumber>;
                errorWeight: z.ZodDefault<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                successWeight: number;
                latencyWeight: number;
                errorWeight: number;
            }, {
                successWeight?: number | undefined;
                latencyWeight?: number | undefined;
                errorWeight?: number | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            initialLevel: "supervised" | "full_auto" | "suggestion" | "semi_auto";
            scoringConfig: {
                successWeight: number;
                latencyWeight: number;
                errorWeight: number;
            };
        }, {
            initialLevel?: "supervised" | "full_auto" | "suggestion" | "semi_auto" | undefined;
            scoringConfig?: {
                successWeight?: number | undefined;
                latencyWeight?: number | undefined;
                errorWeight?: number | undefined;
            } | undefined;
        }>;
        triggerSet: z.ZodDefault<z.ZodArray<z.ZodObject<{
            triggerId: z.ZodString;
            type: z.ZodDefault<z.ZodEnum<["scheduled", "event", "manual"]>>;
            enabled: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            type: "manual" | "scheduled" | "event";
            triggerId: string;
        }, {
            triggerId: string;
            enabled?: boolean | undefined;
            type?: "manual" | "scheduled" | "event" | undefined;
        }>, "many">>;
        autonomyConfig: z.ZodObject<{
            maxAutomationLevel: z.ZodDefault<z.ZodEnum<["suggestion", "supervised", "semi_auto", "full_auto"]>>;
            requireHumanApprovalForHighRisk: z.ZodDefault<z.ZodBoolean>;
            maxRetriesBeforeApproval: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            maxAutomationLevel: "supervised" | "full_auto" | "suggestion" | "semi_auto";
            requireHumanApprovalForHighRisk: boolean;
            maxRetriesBeforeApproval: number;
        }, {
            maxAutomationLevel?: "supervised" | "full_auto" | "suggestion" | "semi_auto" | undefined;
            requireHumanApprovalForHighRisk?: boolean | undefined;
            maxRetriesBeforeApproval?: number | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        pack: {
            version: string;
            packId: string;
        };
        promptBundle: {
            version: string;
            bundleId: string;
        };
        modelBinding: {
            provider: string;
            model: string;
            fallbackChain: string[];
        };
        trustProfile: {
            initialLevel: "supervised" | "full_auto" | "suggestion" | "semi_auto";
            scoringConfig: {
                successWeight: number;
                latencyWeight: number;
                errorWeight: number;
            };
        };
        triggerSet: {
            enabled: boolean;
            type: "manual" | "scheduled" | "event";
            triggerId: string;
        }[];
        autonomyConfig: {
            maxAutomationLevel: "supervised" | "full_auto" | "suggestion" | "semi_auto";
            requireHumanApprovalForHighRisk: boolean;
            maxRetriesBeforeApproval: number;
        };
    }, {
        pack: {
            version: string;
            packId: string;
        };
        promptBundle: {
            version: string;
            bundleId: string;
        };
        modelBinding: {
            provider: string;
            model: string;
            fallbackChain?: string[] | undefined;
        };
        trustProfile: {
            initialLevel?: "supervised" | "full_auto" | "suggestion" | "semi_auto" | undefined;
            scoringConfig?: {
                successWeight?: number | undefined;
                latencyWeight?: number | undefined;
                errorWeight?: number | undefined;
            } | undefined;
        };
        autonomyConfig: {
            maxAutomationLevel?: "supervised" | "full_auto" | "suggestion" | "semi_auto" | undefined;
            requireHumanApprovalForHighRisk?: boolean | undefined;
            maxRetriesBeforeApproval?: number | undefined;
        };
        triggerSet?: {
            triggerId: string;
            enabled?: boolean | undefined;
            type?: "manual" | "scheduled" | "event" | undefined;
        }[] | undefined;
    }>;
    currentVersionId: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    lifecycleState: z.ZodDefault<z.ZodEnum<["draft", "testing", "staging", "canary", "active", "paused", "deprecated", "archived"]>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    createdAt: string;
    agentId: string;
    name: string;
    domainId: string;
    updatedAt: string;
    lifecycleState: "active" | "draft" | "staging" | "deprecated" | "paused" | "archived" | "canary" | "testing";
    owner: {
        path: string;
        orgNodeId: string;
    };
    components: {
        pack: {
            version: string;
            packId: string;
        };
        promptBundle: {
            version: string;
            bundleId: string;
        };
        modelBinding: {
            provider: string;
            model: string;
            fallbackChain: string[];
        };
        trustProfile: {
            initialLevel: "supervised" | "full_auto" | "suggestion" | "semi_auto";
            scoringConfig: {
                successWeight: number;
                latencyWeight: number;
                errorWeight: number;
            };
        };
        triggerSet: {
            enabled: boolean;
            type: "manual" | "scheduled" | "event";
            triggerId: string;
        }[];
        autonomyConfig: {
            maxAutomationLevel: "supervised" | "full_auto" | "suggestion" | "semi_auto";
            requireHumanApprovalForHighRisk: boolean;
            maxRetriesBeforeApproval: number;
        };
    };
    currentVersionId: string;
}, {
    createdAt: string;
    agentId: string;
    name: string;
    domainId: string;
    updatedAt: string;
    owner: {
        path: string;
        orgNodeId: string;
    };
    components: {
        pack: {
            version: string;
            packId: string;
        };
        promptBundle: {
            version: string;
            bundleId: string;
        };
        modelBinding: {
            provider: string;
            model: string;
            fallbackChain?: string[] | undefined;
        };
        trustProfile: {
            initialLevel?: "supervised" | "full_auto" | "suggestion" | "semi_auto" | undefined;
            scoringConfig?: {
                successWeight?: number | undefined;
                latencyWeight?: number | undefined;
                errorWeight?: number | undefined;
            } | undefined;
        };
        autonomyConfig: {
            maxAutomationLevel?: "supervised" | "full_auto" | "suggestion" | "semi_auto" | undefined;
            requireHumanApprovalForHighRisk?: boolean | undefined;
            maxRetriesBeforeApproval?: number | undefined;
        };
        triggerSet?: {
            triggerId: string;
            enabled?: boolean | undefined;
            type?: "manual" | "scheduled" | "event" | undefined;
        }[] | undefined;
    };
    lifecycleState?: "active" | "draft" | "staging" | "deprecated" | "paused" | "archived" | "canary" | "testing" | undefined;
    currentVersionId?: string | undefined;
}>;
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
/**
 * Lists all agents in active states (canary or active).
 */
export declare function listActiveAgents(agents: readonly AgentDefinition[]): AgentDefinition[];
/**
 * Valid state transitions per architecture doc §61.3.
 */
export declare const VALID_LIFECYCLE_TRANSITIONS: ReadonlyMap<AgentLifecycleState, readonly AgentLifecycleState[]>;
/**
 * Checks if a lifecycle state transition is valid.
 */
export declare function isValidLifecycleTransition(from: AgentLifecycleState, to: AgentLifecycleState): boolean;
/**
 * Checks if agent can be promoted (for automatic canary promotion).
 */
export declare function canAutoPromote(state: AgentLifecycleState): boolean;
/**
 * Checks if agent is in a terminal state.
 */
export declare function isTerminalState(state: AgentLifecycleState): boolean;
