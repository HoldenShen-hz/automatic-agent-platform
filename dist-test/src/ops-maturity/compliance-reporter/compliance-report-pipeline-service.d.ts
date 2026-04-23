import { type EvidenceReference } from "./evidence-mapper/index.js";
export interface ComplianceReportTemplateDefinition {
    readonly templateId: string;
    readonly framework: string;
    readonly reportType: string;
    readonly requiredEvidenceTypes: readonly string[];
    readonly renderSchema: readonly string[];
    readonly version: string;
}
export interface ComplianceReportRequest {
    readonly templateId: string;
    readonly evidence: readonly EvidenceReference[];
    readonly requestedBy: string;
    readonly generatedAt?: string;
}
export interface ComplianceReportArtifact {
    readonly artifactId: string;
    readonly templateId: string;
    readonly framework: string;
    readonly reportType: string;
    readonly version: string;
    readonly status: "complete" | "partial";
    readonly missingEvidenceTypes: readonly string[];
    readonly evidenceMap: Readonly<Record<string, readonly string[]>>;
    readonly markdown: string;
    readonly readOnly: true;
    readonly generatedAt: string;
    readonly generatedBy: string;
}
export interface ComplianceReportAccessReceipt {
    readonly artifactId: string;
    readonly accessorId: string;
    readonly accessMode: "read_only";
    readonly accessedAt: string;
}
export declare class ComplianceReportPipelineService {
    private readonly templates;
    private readonly accessLog;
    private readonly evidenceMapper;
    private readonly renderer;
    private readonly registry;
    constructor(templates: readonly ComplianceReportTemplateDefinition[]);
    generate(request: ComplianceReportRequest): ComplianceReportArtifact;
    recordReadAccess(artifact: ComplianceReportArtifact, accessorId: string, accessedAt?: string): ComplianceReportAccessReceipt;
    getAccessLog(artifactId: string): ComplianceReportAccessReceipt[];
    private buildSections;
}
