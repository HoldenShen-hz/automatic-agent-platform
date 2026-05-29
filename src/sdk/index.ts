export { CLI_ENTRYPOINTS } from "./cli/index.js";
export type { CliEntrypoint } from "./cli/index.js";

export {
  ApiError,
  RetryableApiClient,
  buildApiUrl,
  buildAuthHeaders,
  classifyApiError,
  createApiClient,
  createContractEnvelope,
  createEventSubscriber,
  encodeCursor,
  parseCursor,
  parseRetryAfterDelayMs,
  unwrapContractEnvelope,
  wrapInContractEnvelope,
} from "./client-sdk/api-client.js";
export type {
  ApiClientConfig,
  ApiRequestOptions,
  ApiRequestSpec,
  ApiResponse,
  EventSubscriberBackend,
  EventSubscription,
  EventSubscriptionCallback,
  EventSubscriptionHandle,
  PaginatedResponse,
  PaginationSpec,
  RetryConfig,
  VersionHandshakeResult,
} from "./client-sdk/api-client.js";

export {
  HarnessSdk,
  HarnessSdkError,
  buildPlanGraphBundle,
  validatePlanGraph,
  validatePlanGraphBundle,
} from "./harness-sdk/index.js";
export type {
  BudgetReservationResult,
  HarnessSdkAppendStepInput,
  HarnessSdkCreateRunInput,
  HarnessSdkInterPlaneSecurityConfig,
  HarnessSdkLifecycleHooks,
  HarnessSdkReceiptOptions,
  InterPlaneTransport,
  PlanGraphBuildInput,
} from "./harness-sdk/index.js";

export { AdminSdk } from "./admin-sdk/index.js";
export type {
  AdminSdkConfig,
  DecisionDirective,
  DecisionDirectiveScope,
  DecisionDirectiveType,
  OperationalDirective,
  OperationalDirectiveScope,
  OperationalDirectiveType,
} from "./admin-sdk/index.js";

export {
  PackLifecycleOrchestrationService,
  PackPluginCompatibilityService,
  PackScaffoldService,
  validateBusinessPackManifest,
  summarizeCapabilityMatrix,
} from "./pack-sdk/index.js";
export type {
  BusinessPackCapability,
  BusinessPackManifest,
  SdkReleaseDescriptor,
} from "./pack-sdk/index.js";

export {
  PluginContext,
  PluginTestHarness,
  defineAdapter,
  defineEvaluator,
  definePlugin,
  defineRetriever,
  defineTool,
  validatePluginDefinition,
} from "./plugin-sdk/index.js";
export type {
  DefinePluginOptions,
  PluginCapability,
  PluginDefinition,
  PluginResourceLimits,
  PluginRole,
  PluginSecurityConfig,
  PluginType,
} from "./plugin-sdk/index.js";

export { FixtureRedactor, generateTestId } from "./fixture-redact.js";

export { SdkWorkbenchService } from "./workbench/index.js";
export type {
  PublishReadinessReport,
  SdkWorkbenchShortcut,
  SdkWorkbenchSnapshot,
  WorkbenchInstallPlan,
} from "./workbench/index.js";
