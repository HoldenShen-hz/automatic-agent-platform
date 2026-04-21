/**
 * Release Pipeline Service
 */
export * from "./release-pipeline-support.js";
import { type ReleaseEnvironmentConfig, type ReleasePipelineBundle, type ReleasePipelineExecutionExportResult, type ReleasePipelineExportResult, type ReleasePipelineInput, type ReleasePipelineServiceOptions } from "./release-pipeline-support.js";
export declare class ReleasePipelineService {
    private readonly repoRootDir;
    private readonly configRootDir;
    private readonly artifactStore;
    private readonly secretManagementService;
    private readonly store;
    private readonly commandRunner;
    constructor(options?: ReleasePipelineServiceOptions);
    /**
     * Lists all environment configurations from the config directory.
     * Each JSON file in the config root represents one environment.
     */
    listEnvironmentConfigs(): ReleaseEnvironmentConfig[];
    /**
     * Builds a release bundle for the specified environment and version.
     * Validates all inputs, checks workflow files exist, and ensures secrets are ready.
     * The bundle can be exported to artifact storage or executed directly.
     */
    buildBundle(input: ReleasePipelineInput): Promise<ReleasePipelineBundle>;
    /**
     * Exports a release bundle to artifact storage as both JSON and markdown.
     */
    exportBundle(input: ReleasePipelineInput): Promise<ReleasePipelineExportResult>;
    /**
     * Executes the full release pipeline: builds the Docker image, publishes via workflow,
     * and exports the bundle and execution report to artifact storage.
     *
     * Requires secret management service to be configured for secret lease handling.
     */
    executeAndExport(input: ReleasePipelineInput): Promise<ReleasePipelineExecutionExportResult>;
    /**
     * Persists an execution report record to the store if available.
     */
    private persistExecutionReport;
    /**
     * Retrieves the environment config, throwing if not found.
     */
    private requireEnvironmentConfig;
    /**
     * Asserts that a managed secret is ready for use.
     * For rotation-guarded environments, also checks that rotation is not due.
     */
    private assertManagedSecretReady;
    /**
     * Persists a bundle to artifact storage and optionally to the database.
     */
    private persistBundle;
    /**
     * Executes the release pipeline: builds Docker image and triggers publish workflow.
     * Manages secret leases for the registry credential during execution.
     */
    private executeBundle;
    /**
     * Gets secret metadata by describing it through the secret management service.
     */
    private buildDescribedSecretMetadata;
    /**
     * Issues a secret lease for registry access during publish workflow execution.
     */
    private issueRegistryLease;
    /**
     * Updates secret metadata with lease information.
     */
    private applyLeaseToMetadata;
}
