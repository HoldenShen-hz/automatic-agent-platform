/**
 * Enterprise Governance Service
 *
 * Provides comprehensive enterprise governance reporting that synthesizes
 * operations governance, incident handoffs, schema compatibility, supply chain
 * security, and APM export bundles into a single unified report.
 *
 * This is the top-level governance service for enterprise customers who need
 * a complete view of their deployment health, security posture, and compliance
 * status across all environments.
 *
 * The service produces reports that include:
 * - Operations governance status and SLO compliance
 * - Incident handoff packages for shift transitions
 * - Schema compatibility gates for database migrations
 * - Supply chain security scanning with CVE intelligence
 * - APM export bundles for Datadog, Grafana, and OpenTelemetry
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/admin_console_and_human_takeover_contract.md | Human Takeover Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ArtifactStore } from "../../state-evidence/artifacts/artifact-store.js";
import { StorageError, ValidationError } from "../../contracts/errors.js";
import { evaluateSqliteMigrationCompatibility } from "../../state-evidence/truth/sqlite/sqlite-migration-compatibility.js";
import { evaluateSqliteSchemaCompatibilityGate } from "../../state-evidence/truth/sqlite/sqlite-schema-compatibility-gate.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { IndustrialOpsProgramService } from "./industrial-ops-program-service.js";
import { buildMarkdownReport, detectSourceType, extractPackageName, isPrereleaseVersion, mapOpsStatusToHandoffStatus, selectSloActualValue, sha256, summarizeVerdict, } from "./enterprise-governance-support.js";
/**
 * EnterpriseGovernanceService produces comprehensive governance reports.
 * It aggregates data from multiple sources including OperationsGovernanceService,
 * IndustrialOpsProgramService, schema compatibility evaluators, and supply chain scanners.
 */
export class EnterpriseGovernanceService {
    governanceService;
    store;
    artifactStore;
    opsProgramService;
    cveIntelligence;
    constructor(governanceService, store, options = {}) {
        this.governanceService = governanceService;
        this.store = store;
        this.artifactStore = new ArtifactStore(options.artifactStoreOptions);
        this.opsProgramService = new IndustrialOpsProgramService(governanceService);
        this.cveIntelligence = options.cveIntelligence ?? null;
    }
    /**
     * Builds a complete enterprise governance report.
     * Aggregates operations, schema, supply chain, and APM data.
     */
    buildReport(input) {
        const generatedAt = input.generatedAt ?? nowIso();
        // Build operations program report which includes governance data
        const opsProgram = this.opsProgramService.buildReport({
            environment: input.environment,
            generatedAt,
            ...(input.taskId ? { taskId: input.taskId } : {}),
            ...(input.shiftOwner ? { shiftOwner: input.shiftOwner } : {}),
        });
        const governanceReport = opsProgram.governanceReport;
        // Build incident handoff package for shift transitions
        const incidentHandoff = this.buildIncidentHandoffPackage(opsProgram, generatedAt);
        // Evaluate schema compatibility gates
        const schemaGate = this.buildSchemaGateReport();
        // Scan supply chain for security issues
        const supplyChain = this.buildSupplyChainReport({
            generatedAt,
            ...(input.dependencyManifestPath ? { dependencyManifestPath: input.dependencyManifestPath } : {}),
            ...(input.dependencyLockfilePath ? { dependencyLockfilePath: input.dependencyLockfilePath } : {}),
        });
        // Build APM export bundle for external monitoring systems
        const apmExport = this.buildApmExport(governanceReport, incidentHandoff, generatedAt, input.environment);
        // Determine overall status from all sub-reports
        const status = summarizeVerdict(opsProgram.status === "fail" || schemaGate.verdict === "fail" || supplyChain.verdict === "fail", opsProgram.status === "warning" || supplyChain.verdict === "warning" || incidentHandoff.status === "warning");
        return {
            reportId: newId("enterprise_governance"),
            generatedAt,
            environment: input.environment,
            taskId: input.taskId ?? null,
            shiftOwner: opsProgram.shiftOwner,
            status,
            summary: {
                overallStatus: status,
                failingSloCount: governanceReport.summary.failingSloCount,
                schemaVerdict: schemaGate.verdict,
                supplyChainVerdict: supplyChain.verdict,
                incidentHandoffStatus: incidentHandoff.status,
                datadogSeriesCount: apmExport.datadog.series.length,
                grafanaPanelCount: apmExport.grafana.dashboard.panels.length,
            },
            governanceReport,
            opsProgram,
            incidentHandoff,
            schemaGate,
            supplyChain,
            apmExport,
        };
    }
    /**
     * Runs the report and persists records to the database.
     */
    runReport(input) {
        const report = this.buildReport(input);
        const handoffRecord = this.toHandoffRecord(report.incidentHandoff);
        const record = this.toRecord(report);
        // Persist records to database
        this.store.release.insertIncidentHandoffRecord(handoffRecord);
        this.store.release.insertEnterpriseGovernanceReport(record);
        return {
            report,
            record,
            handoffRecord,
        };
    }
    /**
     * Exports the report to artifact storage and persists database records.
     */
    exportReport(input) {
        const result = this.runReport(input);
        const artifactTaskId = this.ensureArtifactTask(result.report.taskId, result.report.generatedAt);
        // Write JSON artifact with lineage metadata
        const jsonArtifact = this.artifactStore.writeJsonArtifact({
            taskId: artifactTaskId,
            executionId: null,
            stepId: null,
            kind: "enterprise_governance_report",
            fileName: `enterprise-governance-${result.report.environment}.json`,
            content: result.report,
            lineage: {
                source: "enterprise_governance_service",
                reportId: result.report.reportId,
                status: result.report.status,
                environment: result.report.environment,
                handoffId: result.report.incidentHandoff.handoffId,
            },
        });
        // Write markdown artifact for human review
        const markdownArtifact = this.artifactStore.writeTextArtifact({
            taskId: artifactTaskId,
            executionId: null,
            stepId: null,
            kind: "enterprise_governance_report_markdown",
            fileName: `enterprise-governance-${result.report.environment}.md`,
            mimeType: "text/markdown",
            content: buildMarkdownReport(result.report),
            lineage: {
                source: "enterprise_governance_service",
                reportId: result.report.reportId,
                status: result.report.status,
                environment: result.report.environment,
                handoffId: result.report.incidentHandoff.handoffId,
            },
        });
        // Persist artifacts to database
        this.store.artifact.insertArtifact(jsonArtifact.record);
        this.store.artifact.insertArtifact(markdownArtifact.record);
        return {
            ...result,
            jsonArtifact: jsonArtifact.ref,
            markdownArtifact: markdownArtifact.ref,
        };
    }
    /**
     * Lists historical enterprise governance reports.
     */
    listHistory(limit = 20) {
        return this.store.release.listEnterpriseGovernanceReports(limit);
    }
    /**
     * Lists historical incident handoff records.
     */
    listIncidentHandoffs(limit = 20) {
        return this.store.release.listIncidentHandoffRecords(limit);
    }
    /**
     * Builds an incident handoff package from the operations program report.
     */
    buildIncidentHandoffPackage(opsProgram, generatedAt) {
        const incident = opsProgram.governanceReport.incident;
        return {
            handoffId: newId("incident_handoff"),
            createdAt: generatedAt,
            environment: opsProgram.environment,
            status: mapOpsStatusToHandoffStatus(opsProgram.status),
            shiftOwner: opsProgram.shiftOwner,
            primaryOncall: opsProgram.governanceReport.oncallPolicy.primaryRole,
            secondaryOncall: opsProgram.governanceReport.oncallPolicy.secondaryRole,
            activeIncidentId: opsProgram.incidentId,
            incidentSeverity: incident?.severity ?? null,
            failingSloKeys: [...opsProgram.failingSloKeys],
            warningSloKeys: [...opsProgram.warningSloKeys],
            recommendedRunbooks: [...opsProgram.recommendedRunbooks],
            recommendedCommands: [...opsProgram.recommendedCommands],
            checklist: [...opsProgram.handoffChecklist],
            summaryNotes: [
                `governance_status=${opsProgram.governanceReport.summary.overallStatus}`,
                `failing_slos=${opsProgram.failingSloKeys.length}`,
                `warning_slos=${opsProgram.warningSloKeys.length}`,
            ],
            timelineMarkdown: incident?.markdown ?? null,
        };
    }
    /**
     * Evaluates schema compatibility gates.
     * Checks both migration portability and breaking changes.
     */
    buildSchemaGateReport() {
        const portability = evaluateSqliteMigrationCompatibility();
        const schemaCompatibility = evaluateSqliteSchemaCompatibilityGate();
        return {
            checkedAt: nowIso(),
            verdict: portability.compatible && schemaCompatibility.compatible ? "pass" : "fail",
            portability,
            schemaCompatibility,
        };
    }
    /**
     * Builds a supply chain security report by scanning package manifests and lockfiles.
     * Detects missing integrity metadata, non-HTTPS sources, prerelease versions,
     * license issues, and CVE vulnerabilities.
     */
    buildSupplyChainReport(input) {
        // Resolve manifest and lockfile paths
        const normalizedManifestPath = input.dependencyManifestPath == null
            ? resolve(process.cwd(), "package.json")
            : resolve(input.dependencyManifestPath);
        const normalizedLockfilePath = input.dependencyLockfilePath == null
            ? resolve(process.cwd(), "package-lock.json")
            : resolve(input.dependencyLockfilePath);
        // Validate files exist
        if (!existsSync(normalizedManifestPath)) {
            throw new StorageError(`enterprise_governance.manifest_not_found:${normalizedManifestPath}`, `enterprise_governance.manifest_not_found:${normalizedManifestPath}`, {
                statusCode: 404,
                retryable: false,
                details: { manifestPath: normalizedManifestPath },
            });
        }
        if (!existsSync(normalizedLockfilePath)) {
            throw new StorageError(`enterprise_governance.lockfile_not_found:${normalizedLockfilePath}`, `enterprise_governance.lockfile_not_found:${normalizedLockfilePath}`, {
                statusCode: 404,
                retryable: false,
                details: { lockfilePath: normalizedLockfilePath },
            });
        }
        // Read and parse manifest and lockfile
        const manifestText = readFileSync(normalizedManifestPath, "utf8");
        const lockfileText = readFileSync(normalizedLockfilePath, "utf8");
        const manifest = JSON.parse(manifestText);
        const lockfile = JSON.parse(lockfileText);
        // Validate lockfile version (only v3 supported)
        if (lockfile.lockfileVersion !== 3 || lockfile.packages == null) {
            throw new ValidationError(`enterprise_governance.unsupported_lockfile:${normalizedLockfilePath}`, `enterprise_governance.unsupported_lockfile:${normalizedLockfilePath}`, {
                retryable: false,
                details: { lockfilePath: normalizedLockfilePath, lockfileVersion: lockfile.lockfileVersion },
            });
        }
        // Build set of direct dependencies for classification
        const directDependencies = new Set([
            ...Object.keys(manifest.dependencies ?? {}),
            ...Object.keys(manifest.devDependencies ?? {}),
            ...Object.keys(manifest.optionalDependencies ?? {}),
            ...Object.keys(manifest.peerDependencies ?? {}),
        ]);
        const findings = [];
        const components = [];
        // Process all packages in lockfile to build SBOM and detect findings
        Object.entries(lockfile.packages)
            .filter(([packagePath]) => packagePath.length > 0)
            .sort(([left], [right]) => left.localeCompare(right))
            .forEach(([packagePath, packageInfo]) => {
            const packageName = extractPackageName(packagePath);
            const component = {
                packageName,
                packagePath,
                version: packageInfo.version ?? "unknown",
                direct: directDependencies.has(packageName),
                dev: packageInfo.dev === true,
                license: packageInfo.license ?? null,
                integrity: packageInfo.integrity ?? null,
                resolved: packageInfo.resolved ?? null,
                sourceType: detectSourceType(packageInfo.resolved),
            };
            components.push(component);
            // Check for missing integrity metadata (critical for production)
            if (component.integrity == null && component.sourceType !== "workspace") {
                findings.push({
                    findingId: "dependency_missing_integrity",
                    severity: "critical",
                    packageName,
                    packagePath,
                    detail: "Package is missing integrity metadata in package-lock.json.",
                });
            }
            // Check for non-approved source types
            if (component.resolved != null && component.sourceType === "other") {
                findings.push({
                    findingId: "dependency_non_https_source",
                    severity: "critical",
                    packageName,
                    packagePath,
                    detail: `Package source ${component.resolved} is not an approved HTTPS or file source.`,
                });
            }
            if (component.sourceType === "file") {
                findings.push({
                    findingId: "dependency_non_https_source",
                    severity: "warning",
                    packageName,
                    packagePath,
                    detail: "Local file dependency detected; provenance must be reviewed before release.",
                });
            }
            // Check for prerelease versions (warning for production)
            if (isPrereleaseVersion(component.version)) {
                findings.push({
                    findingId: "dependency_prerelease_version",
                    severity: "warning",
                    packageName,
                    packagePath,
                    detail: `Prerelease dependency version detected: ${component.version}.`,
                });
            }
            // Check for missing license information
            if (component.license == null || component.license.trim().length === 0) {
                findings.push({
                    findingId: "dependency_license_missing",
                    severity: "warning",
                    packageName,
                    packagePath,
                    detail: "Package does not declare a license in the lockfile metadata.",
                });
            }
        });
        // Check manifest dependency ranges for unstable sources
        Object.entries({
            ...(manifest.dependencies ?? {}),
            ...(manifest.devDependencies ?? {}),
            ...(manifest.optionalDependencies ?? {}),
            ...(manifest.peerDependencies ?? {}),
        })
            .sort(([left], [right]) => left.localeCompare(right))
            .forEach(([packageName, versionRange]) => {
            if (/^(?:latest|\*|github:|git\+|https?:)/i.test(versionRange)) {
                findings.push({
                    findingId: "dependency_manifest_unpinned_source",
                    severity: "warning",
                    packageName,
                    packagePath: null,
                    detail: `Manifest dependency range ${versionRange} is not a stable registry release pin.`,
                });
            }
        });
        // Process extension packages for trust and signature verification
        const extensions = this.store.marketplace.listExtensionPackages(200).map((item) => ({
            packageId: item.packageId,
            extensionId: item.extensionId,
            packageType: item.packageType,
            trustLevel: item.trustLevel,
            lifecycleState: item.lifecycleState,
            signatureVerified: item.signatureVerified === 1,
            reviewRequired: item.reviewRequired === 1,
        }));
        extensions.forEach((item) => {
            // Extensions without signatures are critical security risks
            if (!item.signatureVerified) {
                findings.push({
                    findingId: "extension_signature_missing",
                    severity: "critical",
                    packageName: item.extensionId,
                    packagePath: item.packageId,
                    detail: "Extension package is missing a verified signature or digest attestation.",
                });
            }
            // Extensions pending review may not be enterprise-ready
            if (item.reviewRequired) {
                findings.push({
                    findingId: "extension_review_required",
                    severity: "warning",
                    packageName: item.extensionId,
                    packagePath: item.packageId,
                    detail: "Extension package still requires marketplace review before enterprise release.",
                });
            }
            // Low trust extensions need explicit approval
            if (item.trustLevel !== "internal" && item.trustLevel !== "verified") {
                findings.push({
                    findingId: "extension_low_trust_level",
                    severity: "warning",
                    packageName: item.extensionId,
                    packagePath: item.packageId,
                    detail: `Extension trust level ${item.trustLevel} requires explicit approval and isolation evidence.`,
                });
            }
        });
        // Count findings by severity
        const criticalFindingCount = findings.filter((item) => item.severity === "critical").length;
        const warningFindingCount = findings.filter((item) => item.severity === "warning").length;
        // Perform CVE vulnerability scanning if service is configured
        let cveReport = undefined;
        if (this.cveIntelligence != null && this.cveIntelligence.isLoaded()) {
            // Prepare package list for CVE scanning
            const packages = components.map((c) => ({
                ecosystem: "npm",
                name: c.packageName,
                version: c.version,
            }));
            const cveResult = this.cveIntelligence.generateReport(packages, "supply_chain_scan");
            // Add CVE findings for each matched vulnerability
            for (const match of cveResult.matches) {
                const component = components.find((c) => c.packageName === match.packageName && c.version === match.affectedVersion);
                findings.push({
                    findingId: "cve_vulnerability_found",
                    severity: match.severity === "critical" || match.severity === "high" ? "critical" : "warning",
                    packageName: match.packageName,
                    packagePath: component?.packagePath ?? null,
                    detail: `CVE-2021: ${match.description} (CVSS: ${match.cvssScore ?? "N/A"})`,
                    cveId: match.cveId,
                    cvssScore: match.cvssScore,
                });
            }
            cveReport = {
                totalCves: cveResult.cveCount,
                matchedCves: cveResult.matchedCveCount,
                matches: cveResult.matches,
            };
        }
        return {
            scannedAt: input.generatedAt,
            verdict: summarizeVerdict(criticalFindingCount > 0, warningFindingCount > 0),
            sbomFormat: "npm-package-lock-v3",
            manifestPath: normalizedManifestPath,
            lockfilePath: normalizedLockfilePath,
            manifestSha256: sha256(manifestText),
            lockfileSha256: sha256(lockfileText),
            directDependencyCount: directDependencies.size,
            packageCount: components.length,
            extensionPackageCount: extensions.length,
            summary: {
                criticalFindingCount,
                warningFindingCount,
                unsignedExtensionCount: extensions.filter((item) => !item.signatureVerified).length,
                reviewRequiredExtensionCount: extensions.filter((item) => item.reviewRequired).length,
                nonInternalExtensionCount: extensions.filter((item) => item.trustLevel !== "internal").length,
                cveCriticalCount: cveReport?.matches.filter((m) => m.severity === "critical").length ?? 0,
                cveHighCount: cveReport?.matches.filter((m) => m.severity === "high").length ?? 0,
                cveMediumCount: cveReport?.matches.filter((m) => m.severity === "medium").length ?? 0,
                cveLowCount: cveReport?.matches.filter((m) => m.severity === "low").length ?? 0,
                cveMatchedPackageCount: new Set(cveReport?.matches.map((m) => m.packageName) ?? []).size,
            },
            components,
            extensions,
            findings,
            ...(cveReport ? { cveReport } : {}),
        };
    }
    /**
     * Builds an APM export bundle with metrics in multiple provider formats.
     * Includes OpenTelemetry, Datadog, and Grafana formatted data.
     */
    buildApmExport(governanceReport, handoff, generatedAt, environment) {
        const timestampSeconds = Math.floor(Date.parse(generatedAt) / 1000);
        const tags = [`env:${environment}`, `ops_status:${governanceReport.summary.overallStatus}`];
        // Build metric samples from governance report
        const metricSamples = [
            {
                metric: "aa.task.success_rate_pct",
                unit: "percent",
                type: "gauge",
                value: Number((governanceReport.metrics.taskMetrics.successRate * 100).toFixed(2)),
                tags,
            },
            {
                metric: "aa.task.start_latency_p95_ms",
                unit: "milliseconds",
                type: "gauge",
                value: selectSloActualValue(governanceReport, "task_start_latency"),
                tags,
            },
            {
                metric: "aa.approval.delivery_availability_pct",
                unit: "percent",
                type: "gauge",
                value: selectSloActualValue(governanceReport, "approval_delivery_availability"),
                tags,
            },
            {
                metric: "aa.recovery.success_rate_pct",
                unit: "percent",
                type: "gauge",
                value: selectSloActualValue(governanceReport, "recovery_success_rate"),
                tags,
            },
            {
                metric: "aa.events.pending_tier1_ack_count",
                unit: "count",
                type: "gauge",
                value: governanceReport.metrics.eventMetrics.pendingTier1AckCount,
                tags,
            },
            {
                metric: "aa.cost.total_actual_cost_usd",
                unit: "usd",
                type: "gauge",
                value: governanceReport.metrics.costMetrics.totalActualCostUsd,
                tags,
            },
        ];
        // Build incident events if there's an active incident
        const incidentEvents = handoff.activeIncidentId == null
            ? []
            : [
                {
                    name: "enterprise_incident_handoff",
                    timestamp: generatedAt,
                    attributes: {
                        incident_id: handoff.activeIncidentId,
                        severity: handoff.incidentSeverity ?? "unknown",
                        handoff_status: handoff.status,
                    },
                },
            ];
        return {
            generatedAt,
            environment,
            otel: {
                resourceAttributes: {
                    "service.name": "automatic-agent-platform",
                    "service.namespace": "enterprise-governance",
                    "deployment.environment": environment,
                },
                metricSamples,
                incidentEvents,
            },
            datadog: {
                series: metricSamples.map((sample) => ({
                    metric: sample.metric,
                    type: sample.type,
                    points: [[timestampSeconds, sample.value]],
                    tags: sample.tags,
                    unit: sample.unit,
                })),
                events: handoff.activeIncidentId == null
                    ? []
                    : [
                        {
                            title: `Incident ${handoff.activeIncidentId} handoff`,
                            text: handoff.checklist.join("\n"),
                            alertType: handoff.status === "blocked" ? "error" : handoff.status === "warning" ? "warning" : "info",
                            tags,
                        },
                    ],
            },
            grafana: {
                dashboard: {
                    uid: `enterprise-governance-${environment}`,
                    title: `Enterprise Governance ${environment}`,
                    tags: ["enterprise-governance", environment],
                    panels: metricSamples.map((sample, index) => ({
                        id: index + 1,
                        title: sample.metric,
                        metric: sample.metric,
                        unit: sample.unit,
                        threshold: sample.metric === "aa.task.start_latency_p95_ms" ? 30000 : null,
                    })),
                },
                annotations: handoff.activeIncidentId == null
                    ? []
                    : [
                        {
                            text: `Incident handoff ${handoff.activeIncidentId}`,
                            time: timestampSeconds * 1000,
                            tags: ["incident", environment],
                        },
                    ],
            },
        };
    }
    /**
     * Converts an incident handoff package to a database record.
     */
    toHandoffRecord(handoff) {
        return {
            handoffId: handoff.handoffId,
            incidentId: handoff.activeIncidentId,
            environment: handoff.environment,
            status: handoff.status,
            shiftOwner: handoff.shiftOwner,
            primaryOncall: handoff.primaryOncall,
            secondaryOncall: handoff.secondaryOncall,
            severity: handoff.incidentSeverity,
            handoffJson: JSON.stringify(handoff),
            createdAt: handoff.createdAt,
        };
    }
    /**
     * Converts an enterprise governance report to a database record.
     */
    toRecord(report) {
        return {
            reportId: report.reportId,
            taskId: report.taskId,
            environment: report.environment,
            status: report.status,
            shiftOwner: report.shiftOwner,
            summaryJson: JSON.stringify(report.summary),
            reportJson: JSON.stringify(report),
            generatedAt: report.generatedAt,
            handoffId: report.incidentHandoff.handoffId,
        };
    }
    /**
     * Ensures a task exists for artifact storage, creating a system task if needed.
     */
    ensureArtifactTask(taskId, createdAt) {
        if (taskId != null) {
            return taskId;
        }
        if (this.store.task.getTask("enterprise_governance") == null) {
            this.store.task.insertTask({
                id: "enterprise_governance",
                parentId: null,
                rootId: "enterprise_governance",
                divisionId: "system",
                title: "Enterprise governance evidence",
                status: "done",
                source: "system",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt,
                updatedAt: createdAt,
                completedAt: createdAt,
            });
        }
        return "enterprise_governance";
    }
}
//# sourceMappingURL=enterprise-governance-service.js.map