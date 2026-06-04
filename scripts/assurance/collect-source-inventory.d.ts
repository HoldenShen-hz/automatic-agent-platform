export function classify(rel: string): {
  kind: string;
  plane: string;
  module: string;
};

export function deriveDocTags(rel: string, text: string): string[];

export function inferRiskTags(rel: string, text?: string): string[];

export function inferOwner(
  rel: string,
  classification: {
    kind: string;
    plane: string;
    module: string;
  },
  riskTags?: string[],
): string;

export function detectRoutes(text: string): Array<{
  method: string;
  path: string;
}>;

export function detectEventNames(text: string): string[];

export function detectContractNames(text: string): string[];

export function detectMetricNames(text: string): string[];

export function buildModuleOwnershipRecords(entries: Array<{
  path: string;
  kind: string;
  plane: string;
  module: string;
  owner: string;
  riskTags: string[];
}>): Array<{
  moduleId: string;
  kind: string;
  plane: string;
  module: string;
  owner: string;
  fileCount: number;
  files: string[];
  riskTags: string[];
  hasTests: boolean;
  supportingTests: string[];
  hasContract: boolean;
  supportingContracts: string[];
  ciGates: string[];
}>;
