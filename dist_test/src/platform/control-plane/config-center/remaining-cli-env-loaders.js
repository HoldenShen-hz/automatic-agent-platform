export * from "./remaining-cli-env-support.js";
import { CONTROL_PLANE_ACTIONS, DEPLOYMENT_EXECUTION_ACTIONS, ENTERPRISE_ACTIONS, ENVIRONMENT_NAMES, GATEWAY_TARGET_ACTIONS, INSPECT_KINDS, MARKETPLACE_ACTIONS, MEMORY_ACTIONS, MODEL_ROUTE_CLASSES, MODEL_ROUTE_RISK_LEVELS, OPS_GOVERNANCE_ACTIONS, SECRET_ACTIONS, SHADOW_SNAPSHOT_ACTIONS, SKILL_CREATOR_ACTIONS, TENANT_ACTIONS, WORKER_REGISTER_ACTIONS, optionalEnumValue, optionalEnv, optionalNumber, parseBoolean, parseBooleanMapJson, parseCompatibilityJson, parseInteger, parseJsonValue, parseObjectJson, parseProviderHealthJson, parseStringArrayFromCsv, parseStringArrayJson, parseTypedJson, requiredEnv, requiredEnumValue, } from "./remaining-cli-env-support.js";
export function loadTenantPlatformCliEnv(env = process.env) {
    return {
        dbPath: requiredEnv(env, "AA_DB_PATH"),
        action: optionalEnumValue(env, "AA_TENANT_ACTION", TENANT_ACTIONS) ?? "topology",
        ownerId: optionalEnv(env, "AA_OWNER_ID"),
        displayName: optionalEnv(env, "AA_DISPLAY_NAME"),
        planId: optionalEnv(env, "AA_PLAN_ID"),
        workspaceId: optionalEnv(env, "AA_WORKSPACE_ID"),
        defaultPolicySet: optionalEnv(env, "AA_DEFAULT_POLICY_SET"),
        organizationId: optionalEnv(env, "AA_ORGANIZATION_ID"),
        userId: optionalEnv(env, "AA_USER_ID"),
        role: optionalEnv(env, "AA_ROLE"),
        billingAccountId: optionalEnv(env, "AA_ACCOUNT_ID"),
        tenantId: optionalEnv(env, "AA_TENANT_ID"),
        storageScope: optionalEnv(env, "AA_STORAGE_SCOPE"),
        identityScope: optionalEnv(env, "AA_IDENTITY_SCOPE"),
        policyScope: optionalEnv(env, "AA_POLICY_SCOPE"),
        artifactScope: optionalEnv(env, "AA_ARTIFACT_SCOPE"),
        isolationMode: optionalEnumValue(env, "AA_ISOLATION_MODE", [
            "shared_logical",
            "shared_hard_scoped",
            "dedicated_runtime",
            "dedicated_environment",
        ]),
        deploymentMode: optionalEnumValue(env, "AA_DEPLOYMENT_MODE", ["cloud_shared", "private_cloud", "on_prem"]),
        setAsOrganizationDefault: optionalEnv(env, "AA_SET_DEFAULT_TENANT")?.toLowerCase() === "true",
        environmentId: optionalEnv(env, "AA_ENVIRONMENT_ID"),
        region: optionalEnv(env, "AA_REGION"),
        networkBoundary: optionalEnv(env, "AA_NETWORK_BOUNDARY"),
        bindingId: optionalEnv(env, "AA_BINDING_ID"),
        plane: optionalEnumValue(env, "AA_PLANE", ["transactional", "artifact", "analytics", "memory_archive", "replay"]),
        namespaceId: optionalEnv(env, "AA_NAMESPACE_ID"),
        retentionPolicy: optionalEnv(env, "AA_RETENTION_POLICY"),
        encryptionPolicy: optionalEnv(env, "AA_ENCRYPTION_POLICY"),
        residencyPolicy: optionalEnv(env, "AA_RESIDENCY_POLICY"),
    };
}
/**
 * Loads enterprise capability CLI configuration from environment variables.
 * Supports capability readiness registration and verification.
 */
export function loadEnterpriseCapabilityCliEnv(env = process.env) {
    return {
        dbPath: requiredEnv(env, "AA_DB_PATH"),
        action: optionalEnumValue(env, "AA_ENTERPRISE_ACTION", ENTERPRISE_ACTIONS) ?? "summary",
        artifactRoot: optionalEnv(env, "AA_ARTIFACT_ROOT"),
        readinessId: optionalEnv(env, "AA_READINESS_ID"),
        environment: optionalEnumValue(env, "AA_ENVIRONMENT", ENVIRONMENT_NAMES),
        componentType: optionalEnumValue(env, "AA_COMPONENT_TYPE", [
            "provider",
            "gateway",
            "sandbox",
            "worker_fleet",
            "artifact_store",
            "notification_channel",
            "external_service",
        ]),
        componentId: optionalEnv(env, "AA_COMPONENT_ID"),
        credentialReady: optionalEnv(env, "AA_CREDENTIAL_READY") === "true",
        secondaryGates: parseBooleanMapJson(env, "AA_SECONDARY_GATES_JSON"),
        owner: optionalEnv(env, "AA_OWNER"),
        lastVerifiedAt: optionalEnv(env, "AA_LAST_VERIFIED_AT"),
        isActive: optionalEnv(env, "AA_IS_ACTIVE") !== "false",
        notes: optionalEnv(env, "AA_NOTES"),
        accountId: optionalEnv(env, "AA_ACCOUNT_ID"),
        workspaceId: optionalEnv(env, "AA_WORKSPACE_ID"),
        tenantId: optionalEnv(env, "AA_TENANT_ID"),
        deploymentMode: optionalEnumValue(env, "AA_DEPLOYMENT_MODE", ["cloud_shared", "private_cloud", "on_prem"]),
        generatedAt: optionalEnv(env, "AA_GENERATED_AT"),
        limit: optionalNumber(env, "AA_LIMIT"),
    };
}
/**
 * Loads marketplace CLI configuration from environment variables.
 * Supports package registration, review workflow, and publication management.
 */
export function loadMarketplaceCliEnv(env = process.env) {
    return {
        dbPath: requiredEnv(env, "AA_DB_PATH"),
        action: optionalEnumValue(env, "AA_MARKETPLACE_ACTION", MARKETPLACE_ACTIONS) ?? "summary",
        tenantId: optionalEnv(env, "AA_TENANT_ID"),
        artifactRoot: optionalEnv(env, "AA_ARTIFACT_ROOT"),
        packageId: optionalEnv(env, "AA_PACKAGE_ID"),
        extensionId: optionalEnv(env, "AA_EXTENSION_ID"),
        packageType: optionalEnumValue(env, "AA_PACKAGE_TYPE", ["tool", "skill", "plugin", "mcp", "template"]),
        displayName: optionalEnv(env, "AA_DISPLAY_NAME"),
        version: optionalEnv(env, "AA_VERSION"),
        owner: optionalEnv(env, "AA_OWNER"),
        trustLevel: optionalEnumValue(env, "AA_TRUST_LEVEL", ["internal", "verified", "community", "unknown"]),
        sourceUri: optionalEnv(env, "AA_SOURCE_URI"),
        capabilities: parseStringArrayJson(env, "AA_CAPABILITIES_JSON", false),
        permissions: parseStringArrayJson(env, "AA_PERMISSIONS_JSON", false),
        compatibility: parseCompatibilityJson(env, "AA_COMPATIBILITY_JSON"),
        signatureVerified: optionalEnv(env, "AA_SIGNATURE_VERIFIED") === "true",
        manifestChecksum: optionalEnv(env, "AA_MANIFEST_CHECKSUM"),
        lifecycleState: optionalEnumValue(env, "AA_LIFECYCLE_STATE", [
            "discovered",
            "installed",
            "enabled",
            "disabled",
            "reloaded",
            "removed",
        ]) ?? "installed",
        reviewRequired: optionalEnv(env, "AA_REVIEW_REQUIRED") !== "false",
        createdAt: optionalEnv(env, "AA_CREATED_AT"),
        updatedAt: optionalEnv(env, "AA_UPDATED_AT"),
        reviewId: optionalEnv(env, "AA_REVIEW_ID"),
        findings: parseStringArrayJson(env, "AA_FINDINGS_JSON", false) ?? undefined,
        submitter: optionalEnv(env, "AA_SUBMITTER"),
        submittedAt: optionalEnv(env, "AA_SUBMITTED_AT"),
        reviewStatus: optionalEnumValue(env, "AA_REVIEW_STATUS", ["approved", "rejected"]),
        reviewer: optionalEnv(env, "AA_REVIEWER"),
        reasonCode: optionalEnv(env, "AA_REASON_CODE"),
        decidedAt: optionalEnv(env, "AA_DECIDED_AT"),
        publicationId: optionalEnv(env, "AA_PUBLICATION_ID"),
        channel: optionalEnv(env, "AA_CHANNEL"),
        publishedAt: optionalEnv(env, "AA_PUBLISHED_AT"),
        revokedAt: optionalEnv(env, "AA_REVOKED_AT"),
        generatedAt: optionalEnv(env, "AA_GENERATED_AT"),
        limit: optionalNumber(env, "AA_LIMIT"),
    };
}
/**
 * Loads deployment execution CLI configuration from environment variables.
 * Supports deployment runs with local or simulated runners.
 */
export function loadDeploymentExecutionCliEnv(env = process.env, cwd = process.cwd()) {
    const repoRootDir = optionalEnv(env, "AA_DEPLOYMENT_REPO_ROOT") ?? cwd;
    return {
        action: optionalEnumValue(env, "AA_DEPLOYMENT_EXECUTION_ACTION", DEPLOYMENT_EXECUTION_ACTIONS) ?? "summary",
        repoRootDir,
        dbPath: requiredEnv(env, "AA_DB_PATH"),
        artifactRoot: optionalEnv(env, "AA_DEPLOYMENT_ARTIFACT_ROOT") ?? `${repoRootDir}/data/artifacts`,
        runnerMode: optionalEnumValue(env, "AA_DEPLOYMENT_RUNNER", ["local", "simulate"]) ?? "local",
        environment: requiredEnumValue(env, "AA_DEPLOYMENT_ENVIRONMENT", ENVIRONMENT_NAMES),
        version: requiredEnv(env, "AA_DEPLOYMENT_VERSION"),
        commitSha: requiredEnv(env, "AA_DEPLOYMENT_COMMIT_SHA"),
        rolloutStrategy: requiredEnumValue(env, "AA_DEPLOYMENT_ROLLOUT_STRATEGY", ["rolling", "canary", "blue_green"]),
        generatedAt: optionalEnv(env, "AA_DEPLOYMENT_GENERATED_AT"),
        taskId: optionalEnv(env, "AA_DEPLOYMENT_TASK_ID"),
        execute: optionalEnv(env, "AA_DEPLOYMENT_EXECUTE") === "true",
    };
}
/**
 * Loads control plane balancer CLI configuration from environment variables.
 * Supports coordinator heartbeat, dispatch selection, and queue management.
 */
export function loadControlPlaneBalancerCliEnv(env = process.env) {
    const shards = parseStringArrayJson(env, "AA_COORDINATOR_SHARDS_JSON", false);
    return {
        dbPath: requiredEnv(env, "AA_DB_PATH"),
        action: optionalEnumValue(env, "AA_CONTROL_PLANE_ACTION", CONTROL_PLANE_ACTIONS) ?? "summary",
        coordinatorId: optionalEnv(env, "AA_COORDINATOR_ID"),
        coordinatorRegion: optionalEnv(env, "AA_COORDINATOR_REGION"),
        role: optionalEnv(env, "AA_COORDINATOR_ROLE"),
        queueAffinity: optionalEnv(env, "AA_COORDINATOR_QUEUE"),
        status: optionalEnumValue(env, "AA_COORDINATOR_STATUS", ["active", "draining", "offline"]),
        maxConcurrentDispatches: optionalNumber(env, "AA_COORDINATOR_MAX_DISPATCHES"),
        activeDispatchCount: optionalNumber(env, "AA_COORDINATOR_ACTIVE_DISPATCHES"),
        backlogCount: optionalNumber(env, "AA_COORDINATOR_BACKLOG"),
        cpuPct: optionalNumber(env, "AA_COORDINATOR_CPU_PCT"),
        shards,
        queueName: optionalEnv(env, "AA_CONTROL_PLANE_QUEUE"),
        preferredRegion: optionalEnv(env, "AA_CONTROL_PLANE_REGION"),
        tenantId: optionalEnv(env, "AA_CONTROL_PLANE_TENANT_ID"),
        requestKey: optionalEnv(env, "AA_CONTROL_PLANE_REQUEST_KEY"),
    };
}
/**
 * Loads ops governance CLI configuration from environment variables.
 * Supports operational governance reporting and exports.
 */
export function loadOpsGovernanceCliEnv(env = process.env) {
    return {
        dbPath: requiredEnv(env, "AA_DB_PATH"),
        environment: requiredEnumValue(env, "AA_ENVIRONMENT", ENVIRONMENT_NAMES),
        action: optionalEnumValue(env, "AA_OPS_ACTION", OPS_GOVERNANCE_ACTIONS) ?? "summary",
        generatedAt: optionalEnv(env, "AA_GENERATED_AT"),
        taskId: optionalEnv(env, "AA_OPS_TASK_ID"),
        artifactRoot: optionalEnv(env, "AA_OPS_ARTIFACT_ROOT"),
    };
}
/**
 * Loads secret management CLI configuration from environment variables.
 * Supports secret registration, rotation, leasing, and revocation.
 */
export function loadSecretManagementCliEnv(env = process.env) {
    return {
        dbPath: requiredEnv(env, "AA_DB_PATH"),
        action: optionalEnumValue(env, "AA_SECRET_ACTION", SECRET_ACTIONS) ?? "summary",
        secretRef: optionalEnv(env, "AA_SECRET_REF"),
        displayName: optionalEnv(env, "AA_SECRET_DISPLAY_NAME"),
        category: optionalEnv(env, "AA_SECRET_CATEGORY"),
        providerKind: optionalEnv(env, "AA_SECRET_PROVIDER_KIND"),
        scopeType: optionalEnv(env, "AA_SECRET_SCOPE_TYPE"),
        scopeRef: optionalEnv(env, "AA_SECRET_SCOPE_REF"),
        rotationCadenceDays: optionalNumber(env, "AA_SECRET_ROTATION_CADENCE_DAYS"),
        ttlMinutes: optionalNumber(env, "AA_SECRET_TTL_MINUTES"),
        breakGlass: optionalEnv(env, "AA_SECRET_BREAK_GLASS") === "true",
        metadata: parseObjectJson(env, "AA_SECRET_METADATA"),
        currentVersion: optionalEnv(env, "AA_SECRET_CURRENT_VERSION"),
        requestedBy: optionalEnv(env, "AA_SECRET_REQUESTED_BY"),
        grantedTo: optionalEnv(env, "AA_SECRET_GRANTED_TO"),
        usagePurpose: optionalEnv(env, "AA_SECRET_USAGE_PURPOSE"),
        taskId: optionalEnv(env, "AA_SECRET_TASK_ID"),
        executionId: optionalEnv(env, "AA_SECRET_EXECUTION_ID"),
        expiresAt: optionalEnv(env, "AA_SECRET_EXPIRES_AT"),
        usageMetadata: parseObjectJson(env, "AA_SECRET_USAGE_METADATA"),
        rotationMode: optionalEnv(env, "AA_SECRET_ROTATION_MODE"),
        rotationStatus: optionalEnv(env, "AA_SECRET_ROTATION_STATUS"),
        rotationReasonCode: optionalEnv(env, "AA_SECRET_ROTATION_REASON_CODE"),
        previousVersion: optionalEnv(env, "AA_SECRET_PREVIOUS_VERSION"),
        nextVersion: optionalEnv(env, "AA_SECRET_NEXT_VERSION"),
        rotationMetadata: parseObjectJson(env, "AA_SECRET_ROTATION_METADATA"),
        leaseTtlMinutes: optionalNumber(env, "AA_SECRET_LEASE_TTL_MINUTES"),
        leaseId: optionalEnv(env, "AA_SECRET_LEASE_ID"),
        revocationReasonCode: optionalEnv(env, "AA_SECRET_REVOCATION_REASON_CODE"),
        revokedAt: optionalEnv(env, "AA_SECRET_REVOKED_AT"),
        asOf: optionalEnv(env, "AA_SECRET_AS_OF"),
    };
}
/**
 * Loads worker registration CLI configuration from environment variables.
 * Supports worker challenge issuance and completion handshake.
 */
export function loadWorkerRegisterCliEnv(env = process.env) {
    return {
        dbPath: requiredEnv(env, "AA_DB_PATH"),
        action: requiredEnumValue(env, "AA_WORKER_REGISTER_ACTION", WORKER_REGISTER_ACTIONS),
        configRoot: optionalEnv(env, "AA_CONFIG_ROOT"),
        capabilities: parseStringArrayJson(env, "AA_CAPABILITIES_JSON", true) ?? [],
        occurredAt: optionalEnv(env, "AA_OCCURRED_AT"),
        challengeTtlMs: optionalNumber(env, "AA_CHALLENGE_TTL_MS"),
        workerId: optionalEnv(env, "AA_WORKER_ID"),
        challengeId: optionalEnv(env, "AA_CHALLENGE_ID"),
        challengeToken: optionalEnv(env, "AA_CHALLENGE_TOKEN"),
        maxConcurrency: optionalNumber(env, "AA_MAX_CONCURRENCY"),
        queueAffinity: optionalEnv(env, "AA_QUEUE_AFFINITY"),
        isolationLevel: optionalEnumValue(env, "AA_ISOLATION_LEVEL", ["standard", "hardened", "strict"]),
        repoVersion: optionalEnv(env, "AA_REPO_VERSION"),
        runtimeInstanceId: optionalEnv(env, "AA_RUNTIME_INSTANCE_ID"),
        restartedFromRuntimeInstanceId: optionalEnv(env, "AA_RESTARTED_FROM_RUNTIME_INSTANCE_ID"),
        remoteSessionStatus: optionalEnumValue(env, "AA_REMOTE_SESSION_STATUS", [
            "connecting",
            "connected",
            "reconnecting",
            "degraded",
            "failed",
            "viewer_only",
        ]),
        lastAcknowledgedStreamOffset: optionalEnv(env, "AA_LAST_ACKNOWLEDGED_STREAM_OFFSET"),
        sessionConsistencyCheckStatus: optionalEnumValue(env, "AA_SESSION_CONSISTENCY_CHECK_STATUS", [
            "unknown",
            "passed",
            "mismatch",
        ]),
        sessionConsistencyCheckedAt: optionalEnv(env, "AA_SESSION_CONSISTENCY_CHECKED_AT"),
        workspaceSyncStatus: optionalEnumValue(env, "AA_WORKSPACE_SYNC_STATUS", ["unknown", "aligned", "conflict"]),
        workspaceSyncCheckedAt: optionalEnv(env, "AA_WORKSPACE_SYNC_CHECKED_AT"),
    };
}
export function loadGatewayTargetsCliEnv(env = process.env) {
    return {
        dbPath: optionalEnv(env, "AA_DB_PATH") ?? undefined,
        action: requiredEnumValue(env, "AA_GATEWAY_TARGET_ACTION", GATEWAY_TARGET_ACTIONS),
        channel: optionalEnv(env, "AA_GATEWAY_CHANNEL") ?? undefined,
        targetKind: optionalEnv(env, "AA_GATEWAY_TARGET_KIND") ?? undefined,
        externalTargetId: optionalEnv(env, "AA_GATEWAY_EXTERNAL_TARGET_ID") ?? undefined,
        displayName: optionalEnv(env, "AA_GATEWAY_DISPLAY_NAME") ?? undefined,
        aliases: parseStringArrayJson(env, "AA_GATEWAY_ALIASES_JSON", false) ?? undefined,
        metadata: parseObjectJson(env, "AA_GATEWAY_METADATA_JSON") ?? undefined,
        query: optionalEnv(env, "AA_GATEWAY_QUERY") ?? undefined,
        limit: parseInteger(env, "AA_GATEWAY_LIMIT"),
    };
}
export function loadInspectCliEnv(env = process.env) {
    return {
        dbPath: optionalEnv(env, "AA_DB_PATH") ?? undefined,
        kind: requiredEnumValue(env, "AA_INSPECT_KIND", INSPECT_KINDS),
        taskId: optionalEnv(env, "AA_TASK_ID") ?? undefined,
        executionId: optionalEnv(env, "AA_EXECUTION_ID") ?? undefined,
        approvalId: optionalEnv(env, "AA_APPROVAL_ID") ?? undefined,
        limit: parseInteger(env, "AA_INSPECT_LIMIT"),
        taskStatus: optionalEnv(env, "AA_TASK_STATUS") ?? undefined,
        workflowStatus: optionalEnv(env, "AA_WORKFLOW_STATUS") ?? undefined,
        workflowId: optionalEnv(env, "AA_WORKFLOW_ID") ?? undefined,
        divisionId: optionalEnv(env, "AA_DIVISION_ID") ?? undefined,
        hasPendingApproval: parseBoolean(env, "AA_HAS_PENDING_APPROVAL"),
        decisionType: optionalEnv(env, "AA_DECISION_TYPE") ?? undefined,
        decisionStatus: optionalEnv(env, "AA_DECISION_STATUS") ?? undefined,
        workerStatus: optionalEnv(env, "AA_WORKER_STATUS") ?? undefined,
        placement: optionalEnv(env, "AA_WORKER_PLACEMENT") ?? undefined,
        remoteSessionStatus: optionalEnv(env, "AA_REMOTE_SESSION_STATUS") ?? undefined,
        queueAffinity: optionalEnv(env, "AA_QUEUE_AFFINITY") ?? undefined,
    };
}
export function loadSkillCreatorCliEnv(env = process.env) {
    return {
        action: requiredEnumValue(env, "AA_SKILL_CREATOR_ACTION", SKILL_CREATOR_ACTIONS),
        registerInRegistry: parseBoolean(env, "AA_SKILL_REGISTER") ?? false,
        skillRoot: optionalEnv(env, "AA_SKILL_ROOT") ?? undefined,
        name: optionalEnv(env, "AA_SKILL_NAME") ?? undefined,
        description: optionalEnv(env, "AA_SKILL_DESCRIPTION") ?? undefined,
        version: optionalEnv(env, "AA_SKILL_VERSION") ?? undefined,
        author: optionalEnv(env, "AA_SKILL_AUTHOR") ?? undefined,
        requiredTools: parseStringArrayJson(env, "AA_SKILL_REQUIRED_TOOLS_JSON", false) ?? undefined,
        requiredPermissions: parseStringArrayJson(env, "AA_SKILL_REQUIRED_PERMISSIONS_JSON", false) ?? undefined,
        tags: parseStringArrayJson(env, "AA_SKILL_TAGS_JSON", false) ?? undefined,
        applicableRoles: parseStringArrayJson(env, "AA_SKILL_APPLICABLE_ROLES_JSON", false) ?? undefined,
        resourceDirectories: parseJsonValue(env, "AA_SKILL_RESOURCE_DIRS_JSON") ?? undefined,
        includeOpenAiAgent: parseBoolean(env, "AA_SKILL_INCLUDE_OPENAI_AGENT"),
        overwriteAllowed: parseBoolean(env, "AA_SKILL_OVERWRITE"),
        cacheable: parseBoolean(env, "AA_SKILL_CACHEABLE"),
        cacheTtlSeconds: parseInteger(env, "AA_SKILL_CACHE_TTL_SECONDS"),
        riskLevel: optionalEnv(env, "AA_SKILL_RISK_LEVEL") ?? undefined,
        lifecycle: optionalEnv(env, "AA_SKILL_LIFECYCLE") ?? undefined,
        skillPath: optionalEnv(env, "AA_SKILL_PATH") ?? undefined,
    };
}
export function loadShadowSnapshotCliEnv(env = process.env) {
    return {
        workspaceRoot: requiredEnv(env, "AA_WORKSPACE_ROOT"),
        shadowRoot: requiredEnv(env, "AA_SHADOW_ROOT"),
        action: requiredEnumValue(env, "AA_SHADOW_SNAPSHOT_ACTION", SHADOW_SNAPSHOT_ACTIONS),
        maxEntryBytes: optionalNumber(env, "AA_SHADOW_SNAPSHOT_MAX_ENTRY_BYTES"),
        excludedPaths: parseStringArrayFromCsv(env, "AA_SHADOW_SNAPSHOT_EXCLUDES"),
        snapshotId: optionalEnv(env, "AA_SHADOW_SNAPSHOT_ID"),
        label: optionalEnv(env, "AA_SHADOW_SNAPSHOT_LABEL"),
        reasonCode: optionalEnv(env, "AA_SHADOW_SNAPSHOT_REASON_CODE"),
        actorId: optionalEnv(env, "AA_SHADOW_SNAPSHOT_ACTOR_ID"),
    };
}
export function loadMemoryCliEnv(env = process.env) {
    return {
        dbPath: optionalEnv(env, "AA_DB_PATH") ?? undefined,
        action: requiredEnumValue(env, "AA_MEMORY_ACTION", MEMORY_ACTIONS),
        scope: optionalEnv(env, "AA_MEMORY_SCOPE") ?? undefined,
        taskId: optionalEnv(env, "AA_TASK_ID") ?? undefined,
        sessionId: optionalEnv(env, "AA_SESSION_ID") ?? undefined,
        agentId: optionalEnv(env, "AA_AGENT_ID") ?? undefined,
        executionId: optionalEnv(env, "AA_EXECUTION_ID") ?? undefined,
        memoryId: optionalEnv(env, "AA_MEMORY_ID") ?? undefined,
        memoryText: optionalEnv(env, "AA_MEMORY_TEXT") ?? undefined,
        contentJson: parseTypedJson(env, "AA_MEMORY_CONTENT_JSON"),
        qualityScore: optionalNumber(env, "AA_MEMORY_QUALITY_SCORE") ?? undefined,
        expiresAt: optionalEnv(env, "AA_MEMORY_EXPIRES_AT") ?? undefined,
        classification: optionalEnv(env, "AA_MEMORY_CLASSIFICATION") ?? undefined,
        memoryLayer: optionalEnv(env, "AA_MEMORY_LAYER") ?? undefined,
        sourceTrustLevel: optionalEnv(env, "AA_MEMORY_SOURCE_TRUST") ?? undefined,
        createdAt: optionalEnv(env, "AA_MEMORY_CREATED_AT") ?? undefined,
        evaluatedAt: optionalEnv(env, "AA_MEMORY_EVALUATED_AT") ?? undefined,
        scopes: parseStringArrayFromCsv(env, "AA_MEMORY_SCOPES") ?? undefined,
        memoryLayers: parseStringArrayFromCsv(env, "AA_MEMORY_LAYERS") ?? undefined,
        classifications: parseStringArrayFromCsv(env, "AA_MEMORY_CLASSIFICATIONS") ?? undefined,
        sourceTrustLevels: parseStringArrayFromCsv(env, "AA_MEMORY_SOURCE_TRUST_LEVELS") ?? undefined,
        minQualityScore: optionalNumber(env, "AA_MEMORY_MIN_QUALITY_SCORE") ?? undefined,
        limit: parseInteger(env, "AA_MEMORY_LIMIT"),
        maxPromptMemories: parseInteger(env, "AA_MEMORY_MAX_PROMPT_MEMORIES"),
        maxFewShotExamples: parseInteger(env, "AA_MEMORY_MAX_FEWSHOT_EXAMPLES"),
        queryText: optionalEnv(env, "AA_MEMORY_QUERY_TEXT") ?? undefined,
        taskIntent: optionalEnv(env, "AA_MEMORY_TASK_INTENT") ?? undefined,
        toolNames: parseStringArrayFromCsv(env, "AA_MEMORY_TOOL_NAMES") ?? undefined,
        includeExperienceExamples: parseBoolean(env, "AA_MEMORY_INCLUDE_EXPERIENCE_EXAMPLES"),
        includeExpired: parseBoolean(env, "AA_MEMORY_INCLUDE_EXPIRED") ?? false,
        includeRevoked: parseBoolean(env, "AA_MEMORY_INCLUDE_REVOKED") ?? false,
        prefetchAwait: parseBoolean(env, "AA_MEMORY_PREFETCH_AWAIT") ?? true,
        revokeSourceMemories: parseBoolean(env, "AA_MEMORY_REVOKE_SOURCES") ?? true,
        targetMemoryLayer: optionalEnv(env, "AA_MEMORY_TARGET_LAYER") ?? undefined,
        olderThanCreatedAt: optionalEnv(env, "AA_MEMORY_BEFORE_CREATED_AT") ?? undefined,
        minSourceMemories: parseInteger(env, "AA_MEMORY_MIN_SOURCE_MEMORIES"),
        maxSourceMemories: parseInteger(env, "AA_MEMORY_MAX_SOURCE_MEMORIES"),
        revocationReason: optionalEnv(env, "AA_MEMORY_REVOCATION_REASON") ?? undefined,
        workContext: optionalEnv(env, "AA_MEMORY_WORK_CONTEXT") ?? undefined,
        topOfMind: parseStringArrayFromCsv(env, "AA_MEMORY_TOP_OF_MIND") ?? undefined,
        recentHistory: parseStringArrayFromCsv(env, "AA_MEMORY_RECENT_HISTORY") ?? undefined,
        longTermBackground: parseStringArrayFromCsv(env, "AA_MEMORY_LONG_TERM_BACKGROUND") ?? undefined,
        facts: parseTypedJson(env, "AA_MEMORY_FACTS_JSON"),
        experienceTaskContext: optionalEnv(env, "AA_EXPERIENCE_TASK_CONTEXT") ?? undefined,
        experienceTaskIntent: optionalEnv(env, "AA_EXPERIENCE_TASK_INTENT") ?? undefined,
        experienceTools: parseTypedJson(env, "AA_EXPERIENCE_TOOLS_JSON"),
        experienceOutcome: optionalEnv(env, "AA_EXPERIENCE_OUTCOME") ?? undefined,
        experienceFinalErrorCode: optionalEnv(env, "AA_EXPERIENCE_FINAL_ERROR_CODE") ?? undefined,
        experienceQualityScore: optionalNumber(env, "AA_EXPERIENCE_QUALITY_SCORE") ?? undefined,
    };
}
export function buildMemoryProviderQuery(config) {
    const query = {};
    if (config.taskId != null)
        query.taskId = config.taskId;
    if (config.sessionId != null)
        query.sessionId = config.sessionId;
    if (config.agentId != null)
        query.agentId = config.agentId;
    if (config.executionId != null)
        query.executionId = config.executionId;
    if (config.scopes != null)
        query.scopes = config.scopes;
    if (config.memoryLayers != null)
        query.memoryLayers = config.memoryLayers;
    if (config.classifications != null)
        query.classifications = config.classifications;
    if (config.sourceTrustLevels != null)
        query.sourceTrustLevels = config.sourceTrustLevels;
    if (config.minQualityScore != null)
        query.minQualityScore = config.minQualityScore;
    if (config.limit != null)
        query.limit = config.limit;
    if (config.maxPromptMemories != null)
        query.maxPromptMemories = config.maxPromptMemories;
    if (config.maxFewShotExamples != null)
        query.maxFewShotExamples = config.maxFewShotExamples;
    if (config.queryText != null)
        query.queryText = config.queryText;
    if (config.taskIntent != null)
        query.taskIntent = config.taskIntent;
    if (config.toolNames != null)
        query.toolNames = config.toolNames;
    if (config.evaluatedAt != null)
        query.evaluatedAt = config.evaluatedAt;
    if (config.includeExperienceExamples != null)
        query.includeExperienceExamples = config.includeExperienceExamples;
    return query;
}
export function buildStructuredMemoryContentFromCliEnv(config) {
    if (config.workContext == null
        && config.topOfMind == null
        && config.recentHistory == null
        && config.longTermBackground == null
        && config.facts == null) {
        return undefined;
    }
    return {
        schemaVersion: "memory.v2",
        workContext: config.workContext ?? null,
        topOfMind: config.topOfMind ?? [],
        recentHistory: config.recentHistory ?? [],
        longTermBackground: config.longTermBackground ?? [],
        facts: config.facts ?? [],
    };
}
export function loadModelRoutingCliEnv(env = process.env) {
    return {
        configRoot: optionalEnv(env, "AA_CONFIG_ROOT") ?? undefined,
        dbPath: optionalEnv(env, "AA_DB_PATH") ?? undefined,
        routeClass: optionalEnumValue(env, "AA_MODEL_ROUTE_CLASS", MODEL_ROUTE_CLASSES) ?? undefined,
        riskLevel: optionalEnumValue(env, "AA_MODEL_ROUTE_RISK_LEVEL", MODEL_ROUTE_RISK_LEVELS) ?? undefined,
        preferredProfileName: optionalEnv(env, "AA_MODEL_ROUTE_PREFERRED_PROFILE") ?? undefined,
        pinnedProfileName: optionalEnv(env, "AA_MODEL_ROUTE_PINNED_PROFILE") ?? undefined,
        stickyProfileName: optionalEnv(env, "AA_MODEL_ROUTE_STICKY_PROFILE") ?? undefined,
        turnId: optionalEnv(env, "AA_MODEL_ROUTE_TURN_ID") ?? undefined,
        fallbackLease: parseTypedJson(env, "AA_MODEL_ROUTE_FALLBACK_LEASE_JSON"),
        maxInputPer1kUsd: optionalNumber(env, "AA_MODEL_ROUTE_MAX_INPUT_PER_1K_USD") ?? undefined,
        requiredCapabilities: parseStringArrayFromCsv(env, "AA_MODEL_ROUTE_REQUIRED_CAPABILITIES") ?? undefined,
        allowStrongUpgrade: parseBoolean(env, "AA_MODEL_ROUTE_ALLOW_STRONG_UPGRADE") ?? false,
        providerHealth: parseProviderHealthJson(env, "AA_MODEL_HEALTH_JSON"),
        governanceSnapshot: parseTypedJson(env, "AA_MODEL_ROUTE_GOVERNANCE_SNAPSHOT_JSON"),
        loadGovernanceSnapshot: parseBoolean(env, "AA_MODEL_ROUTE_LOAD_GOVERNANCE_SNAPSHOT") ?? false,
    };
}
//# sourceMappingURL=remaining-cli-env-loaders.js.map