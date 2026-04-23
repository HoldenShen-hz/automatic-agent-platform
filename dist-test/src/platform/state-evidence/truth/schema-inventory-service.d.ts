export type SchemaInventoryCategory = "core_truth" | "runtime_extension" | "governance_extension" | "reliability_extension";
export interface SchemaInventoryRecord {
    readonly tableName: string;
    readonly category: SchemaInventoryCategory;
    readonly source: string;
}
export declare class SchemaInventoryService {
    listTables(): SchemaInventoryRecord[];
    buildSummary(): {
        totalTables: number;
        byCategory: Record<SchemaInventoryCategory, number>;
        sources: string[];
    };
}
