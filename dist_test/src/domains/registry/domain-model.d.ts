import { z } from "zod";
export declare const StepTemplateConfigSchema: z.ZodObject<{
    stepName: z.ZodString;
    toolHints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    modelHints: z.ZodDefault<z.ZodObject<{
        preferredModel: z.ZodOptional<z.ZodString>;
        temperature: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        temperature?: number | undefined;
        preferredModel?: string | undefined;
    }, {
        temperature?: number | undefined;
        preferredModel?: string | undefined;
    }>>;
    outputSchema: z.ZodDefault<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    retryPolicy: z.ZodDefault<z.ZodObject<{
        maxRetries: z.ZodNumber;
        backoffMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        backoffMs: number;
        maxRetries: number;
    }, {
        backoffMs: number;
        maxRetries: number;
    }>>;
    requiresReview: z.ZodDefault<z.ZodBoolean>;
    timeoutMs: z.ZodDefault<z.ZodNumber>;
    dependsOn: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    timeoutMs: number;
    retryPolicy: {
        backoffMs: number;
        maxRetries: number;
    };
    stepName: string;
    toolHints: string[];
    modelHints: {
        temperature?: number | undefined;
        preferredModel?: string | undefined;
    };
    outputSchema: Record<string, unknown> | null;
    requiresReview: boolean;
    dependsOn: string[];
}, {
    stepName: string;
    timeoutMs?: number | undefined;
    retryPolicy?: {
        backoffMs: number;
        maxRetries: number;
    } | undefined;
    toolHints?: string[] | undefined;
    modelHints?: {
        temperature?: number | undefined;
        preferredModel?: string | undefined;
    } | undefined;
    outputSchema?: Record<string, unknown> | null | undefined;
    requiresReview?: boolean | undefined;
    dependsOn?: string[] | undefined;
}>;
export declare const WorkflowConfigSchema: z.ZodObject<{
    workflowId: z.ZodString;
    name: z.ZodString;
    triggerConditions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    steps: z.ZodDefault<z.ZodArray<z.ZodObject<{
        stepName: z.ZodString;
        toolHints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        modelHints: z.ZodDefault<z.ZodObject<{
            preferredModel: z.ZodOptional<z.ZodString>;
            temperature: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            temperature?: number | undefined;
            preferredModel?: string | undefined;
        }, {
            temperature?: number | undefined;
            preferredModel?: string | undefined;
        }>>;
        outputSchema: z.ZodDefault<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        retryPolicy: z.ZodDefault<z.ZodObject<{
            maxRetries: z.ZodNumber;
            backoffMs: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            backoffMs: number;
            maxRetries: number;
        }, {
            backoffMs: number;
            maxRetries: number;
        }>>;
        requiresReview: z.ZodDefault<z.ZodBoolean>;
        timeoutMs: z.ZodDefault<z.ZodNumber>;
        dependsOn: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        timeoutMs: number;
        retryPolicy: {
            backoffMs: number;
            maxRetries: number;
        };
        stepName: string;
        toolHints: string[];
        modelHints: {
            temperature?: number | undefined;
            preferredModel?: string | undefined;
        };
        outputSchema: Record<string, unknown> | null;
        requiresReview: boolean;
        dependsOn: string[];
    }, {
        stepName: string;
        timeoutMs?: number | undefined;
        retryPolicy?: {
            backoffMs: number;
            maxRetries: number;
        } | undefined;
        toolHints?: string[] | undefined;
        modelHints?: {
            temperature?: number | undefined;
            preferredModel?: string | undefined;
        } | undefined;
        outputSchema?: Record<string, unknown> | null | undefined;
        requiresReview?: boolean | undefined;
        dependsOn?: string[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    workflowId: string;
    steps: {
        timeoutMs: number;
        retryPolicy: {
            backoffMs: number;
            maxRetries: number;
        };
        stepName: string;
        toolHints: string[];
        modelHints: {
            temperature?: number | undefined;
            preferredModel?: string | undefined;
        };
        outputSchema: Record<string, unknown> | null;
        requiresReview: boolean;
        dependsOn: string[];
    }[];
    triggerConditions: Record<string, unknown>;
}, {
    name: string;
    workflowId: string;
    steps?: {
        stepName: string;
        timeoutMs?: number | undefined;
        retryPolicy?: {
            backoffMs: number;
            maxRetries: number;
        } | undefined;
        toolHints?: string[] | undefined;
        modelHints?: {
            temperature?: number | undefined;
            preferredModel?: string | undefined;
        } | undefined;
        outputSchema?: Record<string, unknown> | null | undefined;
        requiresReview?: boolean | undefined;
        dependsOn?: string[] | undefined;
    }[] | undefined;
    triggerConditions?: Record<string, unknown> | undefined;
}>;
export declare const ToolBundleEntrySchema: z.ZodObject<{
    toolName: z.ZodString;
    enabled: z.ZodDefault<z.ZodBoolean>;
    configOverrides: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    toolName: string;
    configOverrides: Record<string, unknown>;
}, {
    toolName: string;
    enabled?: boolean | undefined;
    configOverrides?: Record<string, unknown> | undefined;
}>;
export declare const ToolBundleConfigSchema: z.ZodObject<{
    bundleId: z.ZodString;
    tools: z.ZodDefault<z.ZodArray<z.ZodObject<{
        toolName: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
        configOverrides: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        toolName: string;
        configOverrides: Record<string, unknown>;
    }, {
        toolName: string;
        enabled?: boolean | undefined;
        configOverrides?: Record<string, unknown> | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    tools: {
        enabled: boolean;
        toolName: string;
        configOverrides: Record<string, unknown>;
    }[];
    bundleId: string;
}, {
    bundleId: string;
    tools?: {
        toolName: string;
        enabled?: boolean | undefined;
        configOverrides?: Record<string, unknown> | undefined;
    }[] | undefined;
}>;
export declare const OutputContractConfigSchema: z.ZodObject<{
    contractId: z.ZodString;
    name: z.ZodString;
    schema: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    validationLevel: z.ZodDefault<z.ZodEnum<["strict", "lenient", "none"]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    schema: Record<string, unknown>;
    contractId: string;
    validationLevel: "strict" | "none" | "lenient";
}, {
    name: string;
    contractId: string;
    schema?: Record<string, unknown> | undefined;
    validationLevel?: "strict" | "none" | "lenient" | undefined;
}>;
export declare const DomainCapabilityProfileSchema: z.ZodObject<{
    supportedTaskTypes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    requiredTools: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    optionalTools: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    modelPreferences: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    budgetLimits: z.ZodDefault<z.ZodObject<{
        maxTokensPerTask: z.ZodNumber;
        maxCostPerTask: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        maxTokensPerTask: number;
        maxCostPerTask: number;
    }, {
        maxTokensPerTask: number;
        maxCostPerTask: number;
    }>>;
    securityLevel: z.ZodDefault<z.ZodEnum<["standard", "elevated", "restricted"]>>;
}, "strip", z.ZodTypeAny, {
    supportedTaskTypes: string[];
    requiredTools: string[];
    optionalTools: string[];
    modelPreferences: Record<string, string>;
    budgetLimits: {
        maxTokensPerTask: number;
        maxCostPerTask: number;
    };
    securityLevel: "standard" | "restricted" | "elevated";
}, {
    supportedTaskTypes?: string[] | undefined;
    requiredTools?: string[] | undefined;
    optionalTools?: string[] | undefined;
    modelPreferences?: Record<string, string> | undefined;
    budgetLimits?: {
        maxTokensPerTask: number;
        maxCostPerTask: number;
    } | undefined;
    securityLevel?: "standard" | "restricted" | "elevated" | undefined;
}>;
export declare const PluginBindingSchema: z.ZodObject<{
    bindingId: z.ZodString;
    domainId: z.ZodString;
    pluginType: z.ZodEnum<["retriever", "validator", "planner", "presenter", "adapter"]>;
    pluginId: z.ZodString;
    priority: z.ZodDefault<z.ZodNumber>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    config: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    config: Record<string, unknown>;
    priority: number;
    domainId: string;
    pluginId: string;
    bindingId: string;
    pluginType: "retriever" | "validator" | "planner" | "presenter" | "adapter";
}, {
    domainId: string;
    pluginId: string;
    bindingId: string;
    pluginType: "retriever" | "validator" | "planner" | "presenter" | "adapter";
    enabled?: boolean | undefined;
    config?: Record<string, unknown> | undefined;
    priority?: number | undefined;
}>;
export declare const DomainDefinitionSchema: z.ZodObject<{
    domainId: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    version: z.ZodDefault<z.ZodNumber>;
    workflows: z.ZodDefault<z.ZodArray<z.ZodObject<{
        workflowId: z.ZodString;
        name: z.ZodString;
        triggerConditions: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        steps: z.ZodDefault<z.ZodArray<z.ZodObject<{
            stepName: z.ZodString;
            toolHints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            modelHints: z.ZodDefault<z.ZodObject<{
                preferredModel: z.ZodOptional<z.ZodString>;
                temperature: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                temperature?: number | undefined;
                preferredModel?: string | undefined;
            }, {
                temperature?: number | undefined;
                preferredModel?: string | undefined;
            }>>;
            outputSchema: z.ZodDefault<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            retryPolicy: z.ZodDefault<z.ZodObject<{
                maxRetries: z.ZodNumber;
                backoffMs: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                backoffMs: number;
                maxRetries: number;
            }, {
                backoffMs: number;
                maxRetries: number;
            }>>;
            requiresReview: z.ZodDefault<z.ZodBoolean>;
            timeoutMs: z.ZodDefault<z.ZodNumber>;
            dependsOn: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            timeoutMs: number;
            retryPolicy: {
                backoffMs: number;
                maxRetries: number;
            };
            stepName: string;
            toolHints: string[];
            modelHints: {
                temperature?: number | undefined;
                preferredModel?: string | undefined;
            };
            outputSchema: Record<string, unknown> | null;
            requiresReview: boolean;
            dependsOn: string[];
        }, {
            stepName: string;
            timeoutMs?: number | undefined;
            retryPolicy?: {
                backoffMs: number;
                maxRetries: number;
            } | undefined;
            toolHints?: string[] | undefined;
            modelHints?: {
                temperature?: number | undefined;
                preferredModel?: string | undefined;
            } | undefined;
            outputSchema?: Record<string, unknown> | null | undefined;
            requiresReview?: boolean | undefined;
            dependsOn?: string[] | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        workflowId: string;
        steps: {
            timeoutMs: number;
            retryPolicy: {
                backoffMs: number;
                maxRetries: number;
            };
            stepName: string;
            toolHints: string[];
            modelHints: {
                temperature?: number | undefined;
                preferredModel?: string | undefined;
            };
            outputSchema: Record<string, unknown> | null;
            requiresReview: boolean;
            dependsOn: string[];
        }[];
        triggerConditions: Record<string, unknown>;
    }, {
        name: string;
        workflowId: string;
        steps?: {
            stepName: string;
            timeoutMs?: number | undefined;
            retryPolicy?: {
                backoffMs: number;
                maxRetries: number;
            } | undefined;
            toolHints?: string[] | undefined;
            modelHints?: {
                temperature?: number | undefined;
                preferredModel?: string | undefined;
            } | undefined;
            outputSchema?: Record<string, unknown> | null | undefined;
            requiresReview?: boolean | undefined;
            dependsOn?: string[] | undefined;
        }[] | undefined;
        triggerConditions?: Record<string, unknown> | undefined;
    }>, "many">>;
    toolBundles: z.ZodDefault<z.ZodArray<z.ZodObject<{
        bundleId: z.ZodString;
        tools: z.ZodDefault<z.ZodArray<z.ZodObject<{
            toolName: z.ZodString;
            enabled: z.ZodDefault<z.ZodBoolean>;
            configOverrides: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            toolName: string;
            configOverrides: Record<string, unknown>;
        }, {
            toolName: string;
            enabled?: boolean | undefined;
            configOverrides?: Record<string, unknown> | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        tools: {
            enabled: boolean;
            toolName: string;
            configOverrides: Record<string, unknown>;
        }[];
        bundleId: string;
    }, {
        bundleId: string;
        tools?: {
            toolName: string;
            enabled?: boolean | undefined;
            configOverrides?: Record<string, unknown> | undefined;
        }[] | undefined;
    }>, "many">>;
    outputContracts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        contractId: z.ZodString;
        name: z.ZodString;
        schema: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        validationLevel: z.ZodDefault<z.ZodEnum<["strict", "lenient", "none"]>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        schema: Record<string, unknown>;
        contractId: string;
        validationLevel: "strict" | "none" | "lenient";
    }, {
        name: string;
        contractId: string;
        schema?: Record<string, unknown> | undefined;
        validationLevel?: "strict" | "none" | "lenient" | undefined;
    }>, "many">>;
    promptOverrides: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    capabilities: z.ZodObject<{
        supportedTaskTypes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        requiredTools: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        optionalTools: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        modelPreferences: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        budgetLimits: z.ZodDefault<z.ZodObject<{
            maxTokensPerTask: z.ZodNumber;
            maxCostPerTask: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            maxTokensPerTask: number;
            maxCostPerTask: number;
        }, {
            maxTokensPerTask: number;
            maxCostPerTask: number;
        }>>;
        securityLevel: z.ZodDefault<z.ZodEnum<["standard", "elevated", "restricted"]>>;
    }, "strip", z.ZodTypeAny, {
        supportedTaskTypes: string[];
        requiredTools: string[];
        optionalTools: string[];
        modelPreferences: Record<string, string>;
        budgetLimits: {
            maxTokensPerTask: number;
            maxCostPerTask: number;
        };
        securityLevel: "standard" | "restricted" | "elevated";
    }, {
        supportedTaskTypes?: string[] | undefined;
        requiredTools?: string[] | undefined;
        optionalTools?: string[] | undefined;
        modelPreferences?: Record<string, string> | undefined;
        budgetLimits?: {
            maxTokensPerTask: number;
            maxCostPerTask: number;
        } | undefined;
        securityLevel?: "standard" | "restricted" | "elevated" | undefined;
    }>;
    status: z.ZodDefault<z.ZodEnum<["draft", "testing", "active", "deprecated"]>>;
    externalAdapters: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    pluginBindings: z.ZodDefault<z.ZodArray<z.ZodObject<{
        bindingId: z.ZodString;
        domainId: z.ZodString;
        pluginType: z.ZodEnum<["retriever", "validator", "planner", "presenter", "adapter"]>;
        pluginId: z.ZodString;
        priority: z.ZodDefault<z.ZodNumber>;
        enabled: z.ZodDefault<z.ZodBoolean>;
        config: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        config: Record<string, unknown>;
        priority: number;
        domainId: string;
        pluginId: string;
        bindingId: string;
        pluginType: "retriever" | "validator" | "planner" | "presenter" | "adapter";
    }, {
        domainId: string;
        pluginId: string;
        bindingId: string;
        pluginType: "retriever" | "validator" | "planner" | "presenter" | "adapter";
        enabled?: boolean | undefined;
        config?: Record<string, unknown> | undefined;
        priority?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "draft" | "deprecated" | "testing";
    name: string;
    version: number;
    workflows: {
        name: string;
        workflowId: string;
        steps: {
            timeoutMs: number;
            retryPolicy: {
                backoffMs: number;
                maxRetries: number;
            };
            stepName: string;
            toolHints: string[];
            modelHints: {
                temperature?: number | undefined;
                preferredModel?: string | undefined;
            };
            outputSchema: Record<string, unknown> | null;
            requiresReview: boolean;
            dependsOn: string[];
        }[];
        triggerConditions: Record<string, unknown>;
    }[];
    capabilities: {
        supportedTaskTypes: string[];
        requiredTools: string[];
        optionalTools: string[];
        modelPreferences: Record<string, string>;
        budgetLimits: {
            maxTokensPerTask: number;
            maxCostPerTask: number;
        };
        securityLevel: "standard" | "restricted" | "elevated";
    };
    description: string;
    domainId: string;
    toolBundles: {
        tools: {
            enabled: boolean;
            toolName: string;
            configOverrides: Record<string, unknown>;
        }[];
        bundleId: string;
    }[];
    outputContracts: {
        name: string;
        schema: Record<string, unknown>;
        contractId: string;
        validationLevel: "strict" | "none" | "lenient";
    }[];
    promptOverrides: Record<string, string>;
    externalAdapters: string[];
    pluginBindings: {
        enabled: boolean;
        config: Record<string, unknown>;
        priority: number;
        domainId: string;
        pluginId: string;
        bindingId: string;
        pluginType: "retriever" | "validator" | "planner" | "presenter" | "adapter";
    }[];
}, {
    name: string;
    capabilities: {
        supportedTaskTypes?: string[] | undefined;
        requiredTools?: string[] | undefined;
        optionalTools?: string[] | undefined;
        modelPreferences?: Record<string, string> | undefined;
        budgetLimits?: {
            maxTokensPerTask: number;
            maxCostPerTask: number;
        } | undefined;
        securityLevel?: "standard" | "restricted" | "elevated" | undefined;
    };
    description: string;
    domainId: string;
    status?: "active" | "draft" | "deprecated" | "testing" | undefined;
    version?: number | undefined;
    workflows?: {
        name: string;
        workflowId: string;
        steps?: {
            stepName: string;
            timeoutMs?: number | undefined;
            retryPolicy?: {
                backoffMs: number;
                maxRetries: number;
            } | undefined;
            toolHints?: string[] | undefined;
            modelHints?: {
                temperature?: number | undefined;
                preferredModel?: string | undefined;
            } | undefined;
            outputSchema?: Record<string, unknown> | null | undefined;
            requiresReview?: boolean | undefined;
            dependsOn?: string[] | undefined;
        }[] | undefined;
        triggerConditions?: Record<string, unknown> | undefined;
    }[] | undefined;
    toolBundles?: {
        bundleId: string;
        tools?: {
            toolName: string;
            enabled?: boolean | undefined;
            configOverrides?: Record<string, unknown> | undefined;
        }[] | undefined;
    }[] | undefined;
    outputContracts?: {
        name: string;
        contractId: string;
        schema?: Record<string, unknown> | undefined;
        validationLevel?: "strict" | "none" | "lenient" | undefined;
    }[] | undefined;
    promptOverrides?: Record<string, string> | undefined;
    externalAdapters?: string[] | undefined;
    pluginBindings?: {
        domainId: string;
        pluginId: string;
        bindingId: string;
        pluginType: "retriever" | "validator" | "planner" | "presenter" | "adapter";
        enabled?: boolean | undefined;
        config?: Record<string, unknown> | undefined;
        priority?: number | undefined;
    }[] | undefined;
}>;
export type StepTemplateConfig = z.infer<typeof StepTemplateConfigSchema>;
export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;
export type ToolBundleEntry = z.infer<typeof ToolBundleEntrySchema>;
export type ToolBundleConfig = z.infer<typeof ToolBundleConfigSchema>;
export type OutputContractConfig = z.infer<typeof OutputContractConfigSchema>;
export type DomainCapabilityProfile = z.infer<typeof DomainCapabilityProfileSchema>;
export type PluginBinding = z.infer<typeof PluginBindingSchema>;
export type DomainDefinition = z.infer<typeof DomainDefinitionSchema>;
export type DomainDefinitionExtended = DomainDefinition;
