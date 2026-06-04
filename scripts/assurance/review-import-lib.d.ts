export function buildReviewImportArtifacts(input: {
  repoRoot: string;
  reviewsRoot: string;
  outputDir: string;
  generatedAt?: string;
}): any;

export function parseMarkdownTables(content: string, relativePath: string): any[];

export function parseHeadingBlocks(content: string, relativePath: string): any[];

export function resolveConflict(group: Array<{
  status: string;
  sourceFile: string;
  title: string;
  severity?: string | null;
  category?: string;
  rowId?: string;
  sourceRefs?: string[];
  evidenceRefs?: string[];
  latestReviewDate?: string | null;
}>): {
  decision: string;
  decisionBasis: string;
  conflictType: string;
  autoResolved: boolean;
};

export function evaluateReviewImportResult(
  result: {
    coverageReport: {
      unscannedReviewFiles: unknown[];
      filesWithParseWarnings: unknown[];
      reviewSources: Array<{ droppedRows: number }>;
    };
    conflictRecords: Array<{ blocking?: boolean }>;
  },
  options?: {
    allowParseWarnings?: boolean;
    allowConflicts?: boolean;
  },
): {
  pass: boolean;
  reasons: string[];
};
