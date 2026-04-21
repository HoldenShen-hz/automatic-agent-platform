/**
 * @fileoverview Pack Scaffold Service
 *
 * Implements §22.2 Pack SDK core capability: `scaffold(config)`.
 * Generates Pack project structure from template.
 */
export type PackTemplate = "minimal" | "standard" | "full";
export interface ScaffoldConfig {
    packId: string;
    name: string;
    template: PackTemplate;
    domain: string;
    owner: string;
    riskLevel: "low" | "medium" | "high";
}
export interface ScaffoldResult {
    rootDir: string;
    files: string[];
    manifestPath: string;
    entryPointPath: string;
}
export declare class PackScaffoldService {
    /**
     * Generate Pack project structure from template.
     */
    scaffold(config: ScaffoldConfig): ScaffoldResult;
    /**
     * List available templates.
     */
    listTemplates(): Array<{
        id: PackTemplate;
        description: string;
    }>;
}
