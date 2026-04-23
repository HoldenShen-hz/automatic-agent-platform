import { z } from "zod";
export declare const StepTemplateConfigSchema: z.ZodObject<{
    stepName: z.ZodString;
    toolHints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    modelHints: z.ZodDefault<z.ZodObject<{
        preferredModel: z.ZodOptional<z.ZodString>;
        temperature: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        preferredModel?: string | undefined;
        temperature?: number | undefined;
    }, {
        preferredModel?: string | undefined;
        temperature?: number | undefined;
    }>>;
    outputSchema: z.ZodDefault<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    retryPolicy: z.ZodDefault<z.ZodObject<{
        maxRetries: z.ZodNumber;
        backoffMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        maxRetries: number;
        backoffMs: number;
    }, {
        maxRetries: number;
        backoffMs: number;
    }>>;
    requiresReview: z.ZodDefault<z.ZodBoolean>;
    timeoutMs: z.ZodDefault<z.ZodNumber>;
    dependsOn: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    dependsOn: string[];
    retryPolicy: {
        maxRetries: number;
        backoffMs: number;
    };
    stepName: string;
    toolHints: string[];
    modelHints: {
        preferredModel?: string | undefined;
        temperature?: number | undefined;
    };
    outputSchema: Record<string, unknown> | null;
    requiresReview: boolean;
    timeoutMs: number;
}, {
    stepName: string;
    dependsOn?: string[] | undefined;
    retryPolicy?: {
        maxRetries: number;
        backoffMs: number;
    } | undefined;
    toolHints?: string[] | undefined;
    modelHints?: {
        preferredModel?: string | undefined;
        temperature?: number | undefined;
    } | undefined;
    outputSchema?: Record<string, unknown> | null | undefined;
    requiresReview?: boolean | undefined;
    timeoutMs?: number | undefined;
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
            preferredModel?: string | undefined;
            temperature?: number | undefined;
        }, {
            preferredModel?: string | undefined;
            temperature?: number | undefined;
        }>>;
        outputSchema: z.ZodDefault<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        retryPolicy: z.ZodDefault<z.ZodObject<{
            maxRetries: z.ZodNumber;
            backoffMs: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            maxRetries: number;
            backoffMs: number;
        }, {
            maxRetries: number;
            backoffMs: number;
        }>>;
        requiresReview: z.ZodDefault<z.ZodBoolean>;
        timeoutMs: z.ZodDefault<z.ZodNumber>;
        dependsOn: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        dependsOn: string[];
        retryPolicy: {
            maxRetries: number;
            backoffMs: number;
        };
        stepName: string;
        toolHints: string[];
        modelHints: {
            preferredModel?: string | undefined;
            temperature?: number | undefined;
        };
        outputSchema: Record<string, unknown> | null;
        requiresReview: boolean;
        timeoutMs: number;
    }, {
        stepName: string;
        dependsOn?: string[] | undefined;
        retryPolicy?: {
            maxRetries: number;
            backoffMs: number;
        } | undefined;
        toolHints?: string[] | undefined;
        modelHints?: {
            preferredModel?: string | undefined;
            temperature?: number | undefined;
        } | undefined;
        outputSchema?: Record<string, unknown> | null | undefined;
        requiresReview?: boolean | undefined;
        timeoutMs?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    workflowId: string;
    steps: {
        dependsOn: string[];
        retryPolicy: {
            maxRetries: number;
            backoffMs: number;
        };
        stepName: string;
        toolHints: string[];
        modelHints: {
            preferredModel?: string | undefined;
            temperature?: number | undefined;
        };
        outputSchema: Record<string, unknown> | null;
        requiresReview: boolean;
        timeoutMs: number;
    }[];
    triggerConditions: Record<string, unknown>;
}, {
    name: string;
    workflowId: string;
    steps?: {
        stepName: string;
        dependsOn?: string[] | undefined;
        retryPolicy?: {
            maxRetries: number;
            backoffMs: number;
        } | undefined;
        toolHints?: string[] | undefined;
        modelHints?: {
            preferredModel?: string | undefined;
            temperature?: number | undefined;
        } | undefined;
        outputSchema?: Record<string, unknown> | null | undefined;
        requiresReview?: boolean | undefined;
        timeoutMs?: number | undefined;
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
    bundleId: string;
    tools: {
        enabled: boolean;
        toolName: string;
        configOverrides: Record<string, unknown>;
    }[];
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
    validationLevel: "strict" | "lenient" | "none";
}, {
    name: string;
    contractId: string;
    schema?: Record<string, unknown> | undefined;
    validationLevel?: "strict" | "lenient" | "none" | undefined;
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
    securityLevel: "standard" | "elevated" | "restricted";
}, {
    supportedTaskTypes?: string[] | undefined;
    requiredTools?: string[] | undefined;
    optionalTools?: string[] | undefined;
    modelPreferences?: Record<string, string> | undefined;
    budgetLimits?: {
        maxTokensPerTask: number;
        maxCostPerTask: number;
    } | undefined;
    securityLevel?: "standard" | "elevated" | "restricted" | undefined;
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
    domainId: string;
    priority: number;
    pluginId: string;
    bindingId: string;
    pluginType: "retriever" | "validator" | "planner" | "presenter" | "adapter";
    config: Record<string, unknown>;
}, {
    domainId: string;
    pluginId: string;
    bindingId: string;
    pluginType: "retriever" | "validator" | "planner" | "presenter" | "adapter";
    enabled?: boolean | undefined;
    priority?: number | undefined;
    config?: Record<string, unknown> | undefined;
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
                preferredModel?: string | undefined;
                temperature?: number | undefined;
            }, {
                preferredModel?: string | undefined;
                temperature?: number | undefined;
            }>>;
            outputSchema: z.ZodDefault<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            retryPolicy: z.ZodDefault<z.ZodObject<{
                maxRetries: z.ZodNumber;
                backoffMs: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                maxRetries: number;
                backoffMs: number;
            }, {
                maxRetries: number;
                backoffMs: number;
            }>>;
            requiresReview: z.ZodDefault<z.ZodBoolean>;
            timeoutMs: z.ZodDefault<z.ZodNumber>;
            dependsOn: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            dependsOn: string[];
            retryPolicy: {
                maxRetries: number;
                backoffMs: number;
            };
            stepName: string;
            toolHints: string[];
            modelHints: {
                preferredModel?: string | undefined;
                temperature?: number | undefined;
            };
            outputSchema: Record<string, unknown> | null;
            requiresReview: boolean;
            timeoutMs: number;
        }, {
            stepName: string;
            dependsOn?: string[] | undefined;
            retryPolicy?: {
                maxRetries: number;
                backoffMs: number;
            } | undefined;
            toolHints?: string[] | undefined;
            modelHints?: {
                preferredModel?: string | undefined;
                temperature?: number | undefined;
            } | undefined;
            outputSchema?: Record<string, unknown> | null | undefined;
            requiresReview?: boolean | undefined;
            timeoutMs?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        workflowId: string;
        steps: {
            dependsOn: string[];
            retryPolicy: {
                maxRetries: number;
                backoffMs: number;
            };
            stepName: string;
            toolHints: string[];
            modelHints: {
                preferredModel?: string | undefined;
                temperature?: number | undefined;
            };
            outputSchema: Record<string, unknown> | null;
            requiresReview: boolean;
            timeoutMs: number;
        }[];
        triggerConditions: Record<string, unknown>;
    }, {
        name: string;
        workflowId: string;
        steps?: {
            stepName: string;
            dependsOn?: string[] | undefined;
            retryPolicy?: {
                maxRetries: number;
                backoffMs: number;
            } | undefined;
            toolHints?: string[] | undefined;
            modelHints?: {
                preferredModel?: string | undefined;
                temperature?: number | undefined;
            } | undefined;
            outputSchema?: Record<string, unknown> | null | undefined;
            requiresReview?: boolean | undefined;
            timeoutMs?: number | undefined;
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
        bundleId: string;
        tools: {
            enabled: boolean;
            toolName: string;
            configOverrides: Record<string, unknown>;
        }[];
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
        validationLevel: "strict" | "lenient" | "none";
    }, {
        name: string;
        contractId: string;
        schema?: Record<string, unknown> | undefined;
        validationLevel?: "strict" | "lenient" | "none" | undefined;
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
        securityLevel: "standard" | "elevated" | "restricted";
    }, {
        supportedTaskTypes?: string[] | undefined;
        requiredTools?: string[] | undefined;
        optionalTools?: string[] | undefined;
        modelPreferences?: Record<string, string> | undefined;
        budgetLimits?: {
            maxTokensPerTask: number;
            maxCostPerTask: number;
        } | undefined;
        securityLevel?: "standard" | "elevated" | "restricted" | undefined;
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
        domainId: string;
        priority: number;
        pluginId: string;
        bindingId: string;
        pluginType: "retriever" | "validator" | "planner" | "presenter" | "adapter";
        config: Record<string, unknown>;
    }, {
        domainId: string;
        pluginId: string;
        bindingId: string;
        pluginType: "retriever" | "validator" | "planner" | "presenter" | "adapter";
        enabled?: boolean | undefined;
        priority?: number | undefined;
        config?: Record<string, unknown> | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    domainId: string;
    status: "active" | "draft" | "deprecated" | "testing";
    version: number;
    description: string;
    workflows: {
        name: string;
        workflowId: string;
        steps: {
            dependsOn: string[];
            retryPolicy: {
                maxRetries: number;
                backoffMs: number;
            };
            stepName: string;
            toolHints: string[];
            modelHints: {
                preferredModel?: string | undefined;
                temperature?: number | undefined;
            };
            outputSchema: Record<string, unknown> | null;
            requiresReview: boolean;
            timeoutMs: number;
        }[];
        triggerConditions: Record<string, unknown>;
    }[];
    toolBundles: {
        bundleId: string;
        tools: {
            enabled: boolean;
            toolName: string;
            configOverrides: Record<string, unknown>;
        }[];
    }[];
    outputContracts: {
        name: string;
        schema: Record<string, unknown>;
        contractId: string;
        validationLevel: "strict" | "lenient" | "none";
    }[];
    promptOverrides: Record<string, string>;
    capabilities: {
        supportedTaskTypes: string[];
        requiredTools: string[];
        optionalTools: string[];
        modelPreferences: Record<string, string>;
        budgetLimits: {
            maxTokensPerTask: number;
            maxCostPerTask: number;
        };
        securityLevel: "standard" | "elevated" | "restricted";
    };
    externalAdapters: string[];
    pluginBindings: {
        enabled: boolean;
        domainId: string;
        priority: number;
        pluginId: string;
        bindingId: string;
        pluginType: "retriever" | "validator" | "planner" | "presenter" | "adapter";
        config: Record<string, unknown>;
    }[];
}, {
    name: string;
    domainId: string;
    description: string;
    capabilities: {
        supportedTaskTypes?: string[] | undefined;
        requiredTools?: string[] | undefined;
        optionalTools?: string[] | undefined;
        modelPreferences?: Record<string, string> | undefined;
        budgetLimits?: {
            maxTokensPerTask: number;
            maxCostPerTask: number;
        } | undefined;
        securityLevel?: "standard" | "elevated" | "restricted" | undefined;
    };
    status?: "active" | "draft" | "deprecated" | "testing" | undefined;
    version?: number | undefined;
    workflows?: {
        name: string;
        workflowId: string;
        steps?: {
            stepName: string;
            dependsOn?: string[] | undefined;
            retryPolicy?: {
                maxRetries: number;
                backoffMs: number;
            } | undefined;
            toolHints?: string[] | undefined;
            modelHints?: {
                preferredModel?: string | undefined;
                temperature?: number | undefined;
            } | undefined;
            outputSchema?: Record<string, unknown> | null | undefined;
            requiresReview?: boolean | undefined;
            timeoutMs?: number | undefined;
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
        validationLevel?: "strict" | "lenient" | "none" | undefined;
    }[] | undefined;
    promptOverrides?: Record<string, string> | undefined;
    externalAdapters?: string[] | undefined;
    pluginBindings?: {
        domainId: string;
        pluginId: string;
        bindingId: string;
        pluginType: "retriever" | "validator" | "planner" | "presenter" | "adapter";
        enabled?: boolean | undefined;
        priority?: number | undefined;
        config?: Record<string, unknown> | undefined;
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
