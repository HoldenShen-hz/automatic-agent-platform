export const STRIDE_CATEGORIES = [
  "SPOOFING",
  "TAMPERING",
  "REPUDIATION",
  "INFORMATION_DISCLOSURE",
  "DENIAL_OF_SERVICE",
  "ELEVATION_OF_PRIVILEGE",
] as const;

export type StrideCategory = (typeof STRIDE_CATEGORIES)[number];
export type ResidualRiskLevel = "low" | "medium" | "high";

export interface ThreatEntry {
  threatId: string;
  category: StrideCategory;
  title: string;
  scenario: string;
  mitigations: string[];
  implementationRefs: string[];
  residualRisk: ResidualRiskLevel;
}

export interface ThreatMatrix {
  version: string;
  updatedAt: string;
  owner: string;
  entries: ThreatEntry[];
}

export function validateThreatMatrix(matrix: ThreatMatrix): {
  valid: boolean;
  missingCategories: StrideCategory[];
} {
  const present = new Set(matrix.entries.map((entry) => entry.category));
  const missingCategories = STRIDE_CATEGORIES.filter((category) => !present.has(category));
  return {
    valid: missingCategories.length === 0,
    missingCategories,
  };
}

export function listThreatsByCategory(matrix: ThreatMatrix, category: StrideCategory): ThreatEntry[] {
  return matrix.entries.filter((entry) => entry.category === category);
}

