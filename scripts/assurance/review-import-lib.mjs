import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const STATUS_PATTERNS = [
  { match: /needs[_ -]?revalidation|需重验|需要重验/i, value: "needs_revalidation" },
  { match: /stale|过期|陈旧/i, value: "stale" },
  { match: /accepted[_ -]?risk|风险接受|治理项|已复核关闭|已处理（归并）|已处理\(归并\)/i, value: "accepted_risk" },
  { match: /partial|部分完成|部分闭环|conditional/i, value: "partial" },
  { match: /`done`|\bdone\b|已完成|已闭环/i, value: "done" },
  { match: /`fixed`|\bfixed\b|已修复|已解决|已收口|pass(ed)?/i, value: "fixed" },
  { match: /`todo`|\btodo\b|未解决|未完成|待处理|open/i, value: "todo" },
];

const SEVERITY_PATTERNS = [
  { match: /\bP0\b|严重级别.*P0|高严重|critical/i, value: "P0" },
  { match: /\bP1\b|中严重|high/i, value: "P1" },
  { match: /\bP2\b|低严重|medium/i, value: "P2" },
  { match: /\bP3\b|low/i, value: "P3" },
];

const STATUS_PRECEDENCE = {
  todo: 60,
  needs_revalidation: 55,
  stale: 50,
  partial: 40,
  accepted_risk: 30,
  fixed: 20,
  done: 10,
};

const SEVERITY_PRECEDENCE = {
  P0: 40,
  P1: 30,
  P2: 20,
  P3: 10,
};

const ID_HEADERS = new Set(["编号", "id", "gap", "问题id", "issue id", "#"]);
const TITLE_HEADERS = new Set(["问题", "title", "标题", "gap", "内容"]);
const STATUS_HEADERS = new Set(["状态", "问题状态", "结论", "当前结论", "review结论", "review 结论", "当前状态"]);
const SEVERITY_HEADERS = new Set(["严重级别", "severity"]);
const EVIDENCE_HEADERS = new Set(["证据", "evidence", "当前证据", "定向测试", "测试", "回归命令", "依据"]);
const NO_FINDING_WARNING_EXEMPT_FILES = new Set([
  "docs_zh/reviews/audit-pipeline-round6-issues.md",
  "docs_zh/reviews/architecture-code-cross-review.md",
  "docs_zh/reviews/architecture-design-vs-implementation-review.md",
  "docs_zh/reviews/architecture-remaining-plan.md",
  "docs_zh/reviews/current-codebase-gap-review-v1.9.md",
  "docs_zh/reviews/full-cleanup-review.md",
  "docs_zh/reviews/temp-cache-cleanup.md",
  "docs_zh/reviews/v3_2_release_baseline_verification.md",
]);

function normalizeHeader(value) {
  return value.replace(/[`*]/g, "").trim().toLowerCase();
}

function canonicalizeStatus(value) {
  const text = String(value ?? "").trim();
  if (text.length === 0) {
    return "todo";
  }
  for (const pattern of STATUS_PATTERNS) {
    if (pattern.match.test(text)) {
      return pattern.value;
    }
  }
  return "todo";
}

function canonicalizeSeverity(value) {
  const text = String(value ?? "").trim();
  if (text.length === 0) {
    return null;
  }
  for (const pattern of SEVERITY_PATTERNS) {
    if (pattern.match.test(text)) {
      return pattern.value;
    }
  }
  return null;
}

function extractReviewDate(content) {
  const patterns = [
    /维护日期[:：]\s*(\d{4}-\d{2}-\d{2})/,
    /审查日期[:：]\s*(\d{4}-\d{2}-\d{2})/,
    /扫描日期[:：]\s*(\d{4}-\d{2}-\d{2})/,
    /\*\*Review Date\*\*:\s*(\d{4}[/-]\d{2}[/-]\d{2})/,
    /#\s*系统级人工复核审查（(\d{4}-\d{2}-\d{2})）/,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const normalized = match[1].replaceAll("/", "-");
      const parsed = Date.parse(normalized);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toISOString();
      }
    }
  }
  return null;
}

function normalizeTitle(value) {
  return String(value ?? "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return normalizeTitle(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitPipeRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    return false;
  }
  const cells = splitPipeRow(trimmed);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
}

function inferSourceKind(relativePath) {
  const basename = relativePath.split("/").pop() ?? relativePath;
  if (basename.includes("cleanup")) {
    return "cleanup_review";
  }
  if (basename.includes("baseline") || basename.includes("verification")) {
    return "baseline_verification";
  }
  if (basename.includes("system-review")) {
    return "manual_sample";
  }
  if (basename.includes("issues-table")) {
    return "issue_summary";
  }
  return "review_table";
}

function inferCategory(finding) {
  const combined = `${finding.title} ${finding.rawStatus ?? ""} ${finding.sourceFile}`.toLowerCase();
  if (combined.includes("hard wait") || combined.includes("wall-clock")) {
    return "test_quality.hard_wait";
  }
  if (combined.includes("cleanup leak") || combined.includes("泄漏") || combined.includes("leak")) {
    return "test_quality.cleanup_leak";
  }
  if (combined.includes("as any") || combined.includes("type escape") || combined.includes("类型逃逸") || combined.includes("type suppression")) {
    return "test_quality.type_escape_hatch";
  }
  if (combined.includes("release claim") || combined.includes("industry-leading") || combined.includes("production-ready") || combined.includes("行业领先")) {
    return "doc_state.release_claim_overreach";
  }
  if (combined.includes("review结论") || combined.includes("状态冲突") || combined.includes("drift")) {
    return "doc_state.review_status_conflict";
  }
  if (combined.includes("tmp") || combined.includes("artifact") || combined.includes("gitignore") || combined.includes("cleanup")) {
    return "ops_hygiene.temp_artifact_governance";
  }
  if (combined.includes("electron") || combined.includes("preload") || combined.includes("bridge") || combined.includes("endpoint") || combined.includes("api 前缀") || combined.includes("layer c") || combined.includes("ui")) {
    return "ui_contract.bridge_or_endpoint_mismatch";
  }
  if (finding.sourceKind === "manual_sample" || combined.includes("人工复核") || combined.includes("system-review")) {
    return "system_review.manual_sampled_gap";
  }
  return `review.${finding.sourceKind}`;
}

function extractEvidenceRefs(value) {
  const text = String(value ?? "").trim();
  if (text.length === 0) {
    return [];
  }
  return text
    .split(/[；;\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function shouldWarnOnNoFindings(relativePath, content) {
  if (NO_FINDING_WARNING_EXEMPT_FILES.has(relativePath)) {
    return false;
  }
  if (/append-only historical snapshot|不直接代表当前 active defect list|当前结论|当前治理范围|已关闭项|长期演进项|当前阻断项/i.test(content)) {
    return false;
  }
  return true;
}

function buildSourceRef(relativePath, rowId, lineNumber) {
  if (rowId != null && rowId.length > 0) {
    return `${relativePath}#${rowId}`;
  }
  return `${relativePath}:L${lineNumber}`;
}

function toFindingFromTableRow(headers, row, context) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const byHeader = new Map();
  for (let index = 0; index < normalizedHeaders.length; index += 1) {
    byHeader.set(normalizedHeaders[index], row[index] ?? "");
  }

  let rowId = "";
  let title = "";
  let rawStatus = "";
  let severity = null;
  let evidenceCell = "";

  for (const [header, value] of byHeader.entries()) {
    if (ID_HEADERS.has(header) && rowId.length === 0) {
      rowId = String(value).trim();
    }
    if (TITLE_HEADERS.has(header) && title.length === 0) {
      title = String(value).trim();
    }
    if (STATUS_HEADERS.has(header) && rawStatus.length === 0) {
      rawStatus = String(value).trim();
    }
    if (SEVERITY_HEADERS.has(header) && severity == null) {
      severity = canonicalizeSeverity(value);
    }
    if (EVIDENCE_HEADERS.has(header) && evidenceCell.length === 0) {
      evidenceCell = String(value).trim();
    }
  }

  if (normalizedHeaders.includes("gap") && title.length > 0) {
    const gapMatch = title.match(/^([A-Za-z]+-\d+)\s+(.*)$/);
    if (gapMatch) {
      rowId = gapMatch[1];
      title = gapMatch[2];
    }
  }

  if (rowId.length === 0 && normalizedHeaders.length > 0 && /^[A-Za-z]+-\d+$/.test(String(row[0] ?? "").trim())) {
    rowId = String(row[0]).trim();
  }

  if (title.length === 0 && rowId.length > 0 && normalizedHeaders.length === 1) {
    title = rowId;
  }

  if (title.length === 0) {
    title = row.filter((cell) => String(cell).trim().length > 0).join(" | ").trim();
  }

  const status = canonicalizeStatus(rawStatus.length > 0 ? rawStatus : title);
  if (severity == null) {
    severity = canonicalizeSeverity(rawStatus) ?? canonicalizeSeverity(title);
  }

  const finding = {
    reviewSourceId: "",
    sourceFile: context.relativePath,
    rowId: rowId || `row-${context.lineNumber}`,
    title: normalizeTitle(title),
    status,
    rawStatus,
    severity,
    category: "",
    sourceKind: inferSourceKind(context.relativePath),
    sourceRefs: [buildSourceRef(context.relativePath, rowId, context.lineNumber)],
    evidenceRefs: extractEvidenceRefs(evidenceCell),
    testRefs: [],
    docRefs: [],
    latestStatus: status,
    latestReviewDate: context.reviewDate,
    latestClosureNote: null,
    freshness: null,
  };
  finding.category = inferCategory(finding);
  return finding;
}

export function parseMarkdownTables(content, relativePath) {
  const lines = content.split(/\r?\n/);
  const findings = [];
  const reviewDate = extractReviewDate(content);
  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith("|")) {
      continue;
    }
    if (!isSeparatorRow(lines[index + 1] ?? "")) {
      continue;
    }
    const headers = splitPipeRow(line);
    const normalizedHeaders = headers.map(normalizeHeader);
    const looksLikeFindingTable =
      normalizedHeaders.some((header) => ID_HEADERS.has(header) || TITLE_HEADERS.has(header)) &&
      (normalizedHeaders.some((header) => STATUS_HEADERS.has(header) || header === "review结论" || header === "证据" || header === "严重级别") ||
        (normalizedHeaders.some((header) => ID_HEADERS.has(header)) && normalizedHeaders.some((header) => TITLE_HEADERS.has(header))));
    if (!looksLikeFindingTable) {
      continue;
    }
    index += 2;
    while (index < lines.length && lines[index].trim().startsWith("|")) {
      if (!isSeparatorRow(lines[index])) {
        const row = splitPipeRow(lines[index]);
        if (row.some((cell) => cell.length > 0)) {
          findings.push(toFindingFromTableRow(headers, row, { relativePath, lineNumber: index + 1, reviewDate }));
        }
      }
      index += 1;
    }
    index -= 1;
  }
  return findings;
}

export function parseHeadingBlocks(content, relativePath) {
  const lines = content.split(/\r?\n/);
  const findings = [];
  const reviewDate = extractReviewDate(content);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^####\s+(\d+)\.\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+\[([^\]]+)\]/);
    if (!match) {
      continue;
    }
    const [, numericId, area, severityText, title] = match;
    const finding = {
      reviewSourceId: "",
      sourceFile: relativePath,
      rowId: numericId,
      title: normalizeTitle(title),
      status: "todo",
      rawStatus: "todo",
      severity: canonicalizeSeverity(severityText) ?? canonicalizeSeverity(area),
      category: "review.review_table",
      sourceKind: "review_table",
      sourceRefs: [buildSourceRef(relativePath, numericId, index + 1)],
      evidenceRefs: [],
      testRefs: [],
      docRefs: [],
      latestStatus: "todo",
      latestReviewDate: reviewDate,
      latestClosureNote: null,
      freshness: null,
    };
    finding.category = inferCategory(finding);
    findings.push(finding);
  }
  return findings;
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.sourceFile}::${finding.rowId}::${finding.title}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function computeCanonicalKey(finding) {
  return slugify(finding.title);
}

function isResolvedStatus(status) {
  return status === "fixed" || status === "done" || status === "accepted_risk";
}

function isOpenStatus(status) {
  return status === "todo" || status === "partial" || status === "stale" || status === "needs_revalidation";
}

function isTestEvidenceRef(ref) {
  return /^tests\//.test(ref) || /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(ref) || /\bnpm run test:/i.test(ref);
}

function isDocEvidenceRef(ref) {
  return /^(docs_(?:zh|en)\/|README\.md|AGENTS\.md|MEMORY\.md|CONTRIBUTING\.md)/.test(ref);
}

function isReleaseClaimCategory(category) {
  return category === "doc_state.release_claim_overreach" || /^release\./.test(category);
}

function deriveObjectFingerprint(finding) {
  const ref =
    [...(finding.evidenceRefs ?? []), ...(finding.sourceRefs ?? [])].find((entry) => typeof entry === "string" && entry.length > 0) ??
    `${finding.sourceFile}#${finding.rowId}`;
  return String(ref)
    .replace(/:\d+$/, "")
    .split("#")[0]
    .split("/")
    .slice(0, 4)
    .join("/");
}

function inferFreshness(finding, nowIso) {
  if (finding.status === "needs_revalidation") {
    return "needs_revalidation";
  }
  if (finding.status === "stale") {
    return "stale";
  }
  if (isResolvedStatus(finding.status)) {
    return (finding.evidenceRefs?.length ?? 0) > 0 ? "revalidated" : "needs_revalidation";
  }
  const reviewDate = finding.latestReviewDate != null ? Date.parse(finding.latestReviewDate) : Number.NaN;
  const now = Date.parse(nowIso);
  if (Number.isFinite(reviewDate) && Number.isFinite(now)) {
    const ageDays = (now - reviewDate) / (24 * 60 * 60 * 1000);
    if (ageDays > 30) {
      return "stale";
    }
  }
  return "fresh";
}

function chooseDecisionStatus(group) {
  return [...group]
    .sort((left, right) => (STATUS_PRECEDENCE[right.status] ?? 0) - (STATUS_PRECEDENCE[left.status] ?? 0))[0]
    .status;
}

function validateFinding(record) {
  if (typeof record.reviewSourceId !== "string" || !record.reviewSourceId.startsWith("AAS-REVIEW-SRC-")) {
    throw new Error(`review_import.invalid_review_source_id:${record.reviewSourceId}`);
  }
  if (typeof record.sourceFile !== "string" || record.sourceFile.length === 0) {
    throw new Error("review_import.invalid_source_file");
  }
  if (typeof record.rowId !== "string" || record.rowId.length === 0) {
    throw new Error("review_import.invalid_row_id");
  }
  if (typeof record.title !== "string" || record.title.length === 0) {
    throw new Error(`review_import.invalid_title:${record.sourceFile}#${record.rowId}`);
  }
  if (!(record.status in STATUS_PRECEDENCE)) {
    throw new Error(`review_import.invalid_status:${record.status}`);
  }
  if (typeof record.category !== "string" || record.category.length === 0) {
    throw new Error(`review_import.invalid_category:${record.sourceFile}#${record.rowId}`);
  }
  if (!Array.isArray(record.sourceRefs) || record.sourceRefs.length === 0) {
    throw new Error(`review_import.invalid_source_refs:${record.sourceFile}#${record.rowId}`);
  }
}

function computeSourcePriority(sourceFile) {
  if (sourceFile.endsWith("issues-table.md")) return 60;
  if (sourceFile.includes("reaudit")) return 55;
  if (sourceFile.includes("system-review")) return 50;
  if (sourceFile.includes("platforme-full-review")) return 45;
  if (sourceFile.includes("consistency-audit")) return 40;
  if (sourceFile.includes("architecture-design-review")) return 20;
  return 10;
}

function computeFindingScore(finding) {
  const evidenceScore = (finding.evidenceRefs?.length ?? 0) > 0 ? 1000 : 0;
  const severityScore = SEVERITY_PRECEDENCE[finding.severity] ?? 0;
  const sourceScore = computeSourcePriority(finding.sourceFile) * 10;
  const dateScore = finding.latestReviewDate != null ? Date.parse(finding.latestReviewDate) / 1_000_000_000_000 : 0;
  const statusScore = STATUS_PRECEDENCE[finding.status] ?? 0;
  return evidenceScore + severityScore + sourceScore + dateScore + statusScore;
}

export function resolveConflict(group) {
  const ranked = [...group].sort((left, right) => computeFindingScore(right) - computeFindingScore(left));
  const winner = ranked[0];
  const winnerScore = computeFindingScore(winner);
  const runnerUpScore = ranked[1] ? computeFindingScore(ranked[1]) : Number.NEGATIVE_INFINITY;
  const uniqueStatuses = [...new Set(group.map((item) => item.status))];
  const uniqueSeverities = [...new Set(group.map((item) => item.severity).filter((value) => value != null))];
  const hasResolvedReview = group.some((item) => isResolvedStatus(item.status));
  const hasOpenReview = group.some((item) => isOpenStatus(item.status));
  const hasTestEvidence = group.some((item) => (item.evidenceRefs ?? []).some(isTestEvidenceRef));
  const hasRuntimeEvidence = group.some((item) =>
    (item.evidenceRefs ?? []).some((ref) => !isDocEvidenceRef(ref) && !isTestEvidenceRef(ref)),
  );
  const hasReleaseClaim = group.some((item) => isReleaseClaimCategory(item.category));
  const resolvedWithoutEvidence = group.some((item) => isResolvedStatus(item.status) && (item.evidenceRefs?.length ?? 0) === 0);
  const distinctObjects = new Set(group.map(deriveObjectFingerprint));
  const severityCounts = new Map();
  for (const item of group) {
    const severity = item.severity ?? "unknown";
    severityCounts.set(severity, (severityCounts.get(severity) ?? 0) + 1);
  }
  const rankedSeverityCounts = [...severityCounts.entries()].sort((left, right) => {
    const precedenceDelta = (SEVERITY_PRECEDENCE[right[0]] ?? 0) - (SEVERITY_PRECEDENCE[left[0]] ?? 0);
    if (precedenceDelta !== 0) {
      return precedenceDelta;
    }
    return right[1] - left[1];
  });
  const dominantSeverityCount = rankedSeverityCounts[0]?.[1] ?? 0;
  const runnerUpSeverityCount = rankedSeverityCounts[1]?.[1] ?? 0;
  const severityAutoResolved =
    uniqueStatuses.length === 1 &&
    uniqueSeverities.length > 1 &&
    dominantSeverityCount > runnerUpSeverityCount;
  const autoResolved = group.length > 1 && (winnerScore > runnerUpScore || severityAutoResolved);
  let conflictType = "status_mismatch";
  if (hasReleaseClaim && resolvedWithoutEvidence) {
    conflictType = "release_claim_vs_evidence_missing";
  } else if (hasResolvedReview && hasOpenReview && hasTestEvidence) {
    conflictType = "review_fixed_vs_test_failed";
  } else if (hasResolvedReview && hasOpenReview && hasRuntimeEvidence) {
    conflictType = "doc_claim_vs_runtime";
  } else if (uniqueSeverities.length > 1) {
    conflictType = "severity_mismatch";
  } else if (distinctObjects.size > 1) {
    conflictType = "duplicate_but_not_same_object";
  }
  let decisionBasis = autoResolved
    ? "stronger_evidence_or_newer_review_precedes_weaker_or_older_review"
    : "manual_revalidation_required_due_to_ambiguous_review_conflict";
  if (conflictType === "review_fixed_vs_test_failed" && hasTestEvidence) {
    decisionBasis = autoResolved
      ? "executable_test_evidence_precedes_review_note"
      : "manual_revalidation_required_due_to_review_fixed_vs_test_failed";
  } else if (conflictType === "doc_claim_vs_runtime" && hasRuntimeEvidence) {
    decisionBasis = autoResolved
      ? "runtime_or_code_evidence_precedes_doc_claim"
      : "manual_revalidation_required_due_to_doc_claim_vs_runtime";
  } else if (conflictType === "release_claim_vs_evidence_missing" && resolvedWithoutEvidence) {
    decisionBasis = "missing_release_evidence_precludes_auto_close";
  } else if (conflictType === "severity_mismatch") {
    decisionBasis = autoResolved
      ? "higher_severity_or_stronger_evidence_precedes_lower_severity_review_note"
      : "manual_revalidation_required_due_to_severity_mismatch";
  } else if (conflictType === "duplicate_but_not_same_object") {
    decisionBasis = autoResolved
      ? "newer_or_better_evidenced_review_precedes_duplicate_title_collision"
      : "manual_revalidation_required_due_to_duplicate_title_but_distinct_object";
  }
  return {
    decision: winner.status,
    decisionBasis,
    conflictType,
    autoResolved,
  };
}

function collectReviewFiles(reviewsRoot) {
  return readdirSync(reviewsRoot)
    .filter((entry) => extname(entry) === ".md")
    .map((entry) => join(reviewsRoot, entry))
    .filter((entry) => statSync(entry).isFile())
    .sort((left, right) => left.localeCompare(right));
}

function buildCoverageEntry(relativePath, detectedRows, importedRows, normalizedRows, droppedRows, dropReasons) {
  return {
    sourceFile: relativePath,
    detectedRows,
    rawImportedRows: importedRows,
    normalizedLinkedRows: normalizedRows,
    droppedRows,
    dropReasons,
  };
}

const REVIEWER_PATTERNS = [
  /(?:^|\n)\s*(?:>+\s*)?(?:\*\*)?(?:Reviewer|reviewer|Reviewed by|reviewed by|复核人|审查人|审核人)(?:\*\*)?\s*[:：]\s*([^\n]+)/g,
];

const CHECKLIST_PATTERNS = {
  reviewedFiles: [/reviewed files/i, /审阅文件| reviewed file /i, /覆盖文件|检查文件|reviewed sources?/i],
  reviewedContracts: [/reviewed contracts/i, /审阅合同|检查合同|contract 审查|contract review/i],
  reviewedTests: [/reviewed tests/i, /审阅测试|定向测试|回归测试|tests?\//i],
  reviewedCIGates: [/reviewed ci gates/i, /ci gates?/i, /审核 ci|检查 ci|rc:check|ci:baseline|\.github\/workflows/i],
  unverifiedAssumptions: [/unverified assumptions/i, /未知假设|未验证假设|依赖假设|assumption/i],
  foundIssues: [/found issues/i, /发现问题|问题清单|问题表/i],
  missedAreas: [/missed areas/i, /blind spot/i, /未覆盖|盲区|遗漏范围/i],
  confidenceScore: [/confidence score/i, /置信度|confidence[:：]\s*\d/i],
};

const BLIND_SPOT_PATTERNS = {
  missedPaths: [/missed areas/i, /blind spot/i, /未覆盖哪些路径|未覆盖范围|遗漏范围/i],
  assumptionDependent: [/unverified assumptions/i, /依赖假设|结论依赖假设|assumption/i],
  nonAutomatedChecks: [/无法自动验证/i, /cannot be automatically verified/i, /manual verification required/i],
  runtimeOrChaos: [/runtime\/chaos/i, /chaos test/i, /runtime test/i, /需要 runtime/i, /需要 chaos/i],
};

function matchesAnyPattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function extractReviewerNames(content) {
  const reviewers = new Set();
  for (const pattern of REVIEWER_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const reviewer = match[1]
        .split(/[，,;/]/)[0]
        .replace(/[`*]/g, "")
        .trim();
      if (reviewer.length > 0) {
        reviewers.add(reviewer);
      }
    }
  }
  return [...reviewers];
}

function parseConfidenceScore(content) {
  const patterns = [
    /confidence score\s*[:：]\s*(\d+(?:\.\d+)?)/i,
    /置信度\s*[:：]\s*(\d+(?:\.\d+)?)/i,
    /confidence\s*[:：]\s*(\d+(?:\.\d+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (!match) {
      continue;
    }
    const score = Number(match[1]);
    if (Number.isFinite(score)) {
      return score;
    }
  }
  return null;
}

function buildReviewEvidenceEntry(relativePath, content, findings) {
  const reviewers = extractReviewerNames(content);
  const checklist = {
    reviewedFiles: matchesAnyPattern(content, CHECKLIST_PATTERNS.reviewedFiles),
    reviewedContracts: matchesAnyPattern(content, CHECKLIST_PATTERNS.reviewedContracts),
    reviewedTests: matchesAnyPattern(content, CHECKLIST_PATTERNS.reviewedTests),
    reviewedCIGates: matchesAnyPattern(content, CHECKLIST_PATTERNS.reviewedCIGates),
    unverifiedAssumptions: matchesAnyPattern(content, CHECKLIST_PATTERNS.unverifiedAssumptions),
    foundIssues: findings.length > 0 || matchesAnyPattern(content, CHECKLIST_PATTERNS.foundIssues),
    missedAreas: matchesAnyPattern(content, CHECKLIST_PATTERNS.missedAreas),
    confidenceScore: matchesAnyPattern(content, CHECKLIST_PATTERNS.confidenceScore),
  };
  const blindSpotDeclaration = {
    missedPaths: matchesAnyPattern(content, BLIND_SPOT_PATTERNS.missedPaths),
    assumptionDependent: matchesAnyPattern(content, BLIND_SPOT_PATTERNS.assumptionDependent),
    nonAutomatedChecks: matchesAnyPattern(content, BLIND_SPOT_PATTERNS.nonAutomatedChecks),
    runtimeOrChaos: matchesAnyPattern(content, BLIND_SPOT_PATTERNS.runtimeOrChaos),
  };
  const p0FindingCount = findings.filter((finding) => finding.severity === "P0").length;
  const independentReviewMarker =
    /independent reviewer|independent review|dual-person|双人独立审查|双人复核|独立复核|三路并行专家审查|parallel expert reviewers/i.test(
      content,
    );
  const checklistPresent = Object.values(checklist).every(Boolean);
  const blindSpotPresent =
    blindSpotDeclaration.missedPaths &&
    (blindSpotDeclaration.assumptionDependent || checklist.unverifiedAssumptions) &&
    (blindSpotDeclaration.nonAutomatedChecks || blindSpotDeclaration.runtimeOrChaos);
  const dualPersonRequired = p0FindingCount > 0;
  const dualPersonSatisfied = !dualPersonRequired || reviewers.length >= 2 || independentReviewMarker;

  return {
    sourceFile: relativePath,
    findingCount: findings.length,
    p0FindingCount,
    reviewers,
    reviewerCount: reviewers.length,
    confidenceScore: parseConfidenceScore(content),
    checklist,
    blindSpotDeclaration: {
      ...blindSpotDeclaration,
      present: blindSpotPresent,
    },
    dualPersonReview: {
      required: dualPersonRequired,
      satisfied: dualPersonSatisfied,
      independentReviewMarker,
    },
    releaseEvidenceEligible: checklistPresent && blindSpotPresent && dualPersonSatisfied,
  };
}

function writeJson(targetPath, value) {
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(targetPath, values) {
  mkdirSync(dirname(targetPath), { recursive: true });
  const payload = values.map((value) => JSON.stringify(value)).join("\n");
  writeFileSync(targetPath, payload.length > 0 ? `${payload}\n` : "", "utf8");
}

export function buildReviewImportArtifacts(options = {}) {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const reviewsRoot = resolve(repoRoot, options.reviewsRoot ?? "docs_zh/reviews");
  const outputDir = resolve(repoRoot, options.outputDir ?? "artifacts/assurance");
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  const reviewFiles = collectReviewFiles(reviewsRoot);
  const rawFindings = [];
  const coverageEntries = [];
  const reviewEvidenceEntries = [];
  const filesWithParseWarnings = [];
  const unscannedReviewFiles = [];

  for (const filePath of reviewFiles) {
    const relativePath = relative(repoRoot, filePath).replaceAll("\\", "/");
    const content = readFileSync(filePath, "utf8");
    const parsed = dedupeFindings([
      ...parseMarkdownTables(content, relativePath),
      ...parseHeadingBlocks(content, relativePath),
    ]);

    if (parsed.length === 0 && !relativePath.endsWith("/README.md") && shouldWarnOnNoFindings(relativePath, content)) {
      filesWithParseWarnings.push({
        sourceFile: relativePath,
        warning: "no_structured_findings_detected",
      });
    }

    const imported = [];
    const dropReasons = [];
    for (let index = 0; index < parsed.length; index += 1) {
      const finding = {
        ...parsed[index],
        reviewSourceId: `AAS-REVIEW-SRC-${String(rawFindings.length + imported.length + 1).padStart(6, "0")}`,
      };
      try {
        finding.freshness = inferFreshness(finding, generatedAt);
        validateFinding(finding);
        imported.push(finding);
      } catch (error) {
        dropReasons.push(error instanceof Error ? error.message : String(error));
      }
    }

    coverageEntries.push(
      buildCoverageEntry(relativePath, parsed.length, imported.length, imported.length, parsed.length - imported.length, dropReasons),
    );
    reviewEvidenceEntries.push(buildReviewEvidenceEntry(relativePath, content, imported));
    rawFindings.push(...imported);
  }

  const grouped = new Map();
  for (const finding of rawFindings) {
    const key = computeCanonicalKey(finding);
    const group = grouped.get(key) ?? [];
    group.push(finding);
    grouped.set(key, group);
  }

  const normalizedFindings = [];
  const conflictRecords = [];
  let issueCounter = 1;

  for (const group of grouped.values()) {
    const canonicalIssueId = `AAS-ISSUE-${String(issueCounter).padStart(6, "0")}`;
    issueCounter += 1;
    const resolution = resolveConflict(group);
    const decision = resolution.decision;
    const sourceRefs = [...new Set(group.flatMap((item) => item.sourceRefs))];
    const evidenceRefs = [...new Set(group.flatMap((item) => item.evidenceRefs))];
    const latest = group[group.length - 1];
    normalizedFindings.push({
      ...latest,
        canonicalIssueId,
        status: decision,
        latestStatus: decision,
      freshness: inferFreshness({ ...latest, status: decision, evidenceRefs }, generatedAt),
      sourceRefs,
      evidenceRefs,
    });

    const uniqueStatuses = [...new Set(group.map((item) => item.status))];
    const uniqueSeverities = [...new Set(group.map((item) => item.severity).filter((value) => value != null))];
    const distinctObjects = new Set(group.map(deriveObjectFingerprint));
    const shouldEmitConflict =
      group.length > 1 &&
      (
        uniqueStatuses.length > 1 ||
        uniqueSeverities.length > 1 ||
        distinctObjects.size > 1 ||
        resolution.conflictType !== "status_mismatch"
      );
    if (shouldEmitConflict) {
      conflictRecords.push({
        conflictId: `AAS-REVIEW-CONFLICT-${String(conflictRecords.length + 1).padStart(6, "0")}`,
        canonicalIssueId,
        sourceRefs,
        conflictType: resolution.conflictType,
        candidates: group.map((item) => ({
          status: item.status,
          severity: item.severity ?? null,
          basis: "review_row",
          evidenceRefs: item.evidenceRefs,
        })),
        decision,
        decisionBasis: resolution.decisionBasis,
        blocking: !resolution.autoResolved && resolution.conflictType !== "duplicate_but_not_same_object",
        decidedAt: generatedAt,
        decidedBy: "assurance:review-import",
      });
    }
  }

  const coverageReport = {
    generatedAt,
    reviewSources: coverageEntries,
    unscannedReviewFiles,
    filesWithParseWarnings,
    overallStatus:
      unscannedReviewFiles.length === 0 &&
      filesWithParseWarnings.length === 0 &&
      coverageEntries.every((entry) => entry.detectedRows === entry.rawImportedRows && entry.droppedRows === 0)
        ? "pass"
        : "partial",
  };
  const reviewEvidenceReadinessReport = {
    generatedAt,
    reviewSources: reviewEvidenceEntries,
    summary: {
      totalSources: reviewEvidenceEntries.length,
      eligibleSources: reviewEvidenceEntries.filter((entry) => entry.releaseEvidenceEligible).length,
      blindSpotDeclarationPresentCount: reviewEvidenceEntries.filter((entry) => entry.blindSpotDeclaration.present).length,
      checklistCompleteCount: reviewEvidenceEntries.filter((entry) =>
        Object.values(entry.checklist).every(Boolean)
      ).length,
      dualPersonRequiredCount: reviewEvidenceEntries.filter((entry) => entry.dualPersonReview.required).length,
      dualPersonSatisfiedCount: reviewEvidenceEntries.filter((entry) => entry.dualPersonReview.satisfied).length,
    },
  };

  const rawPath = join(outputDir, "review-ledger.raw.jsonl");
  const normalizedPath = join(outputDir, "review-ledger.normalized.jsonl");
  const coveragePath = join(outputDir, "review-source-coverage-report.json");
  const conflictsPath = join(outputDir, "review-conflict-resolution-report.jsonl");
  const reviewEvidencePath = join(outputDir, "review-evidence-readiness-report.json");

  writeJsonl(rawPath, rawFindings);
  writeJsonl(normalizedPath, normalizedFindings);
  writeJson(coveragePath, coverageReport);
  writeJsonl(conflictsPath, conflictRecords);
  writeJson(reviewEvidencePath, reviewEvidenceReadinessReport);

  return {
    rawFindings,
    normalizedFindings,
    coverageReport,
    conflictRecords,
    reviewEvidenceReadinessReport,
    outputs: {
      rawPath,
      normalizedPath,
      coveragePath,
      conflictsPath,
      reviewEvidencePath,
    },
  };
}

export function evaluateReviewImportResult(result, options = {}) {
  const allowParseWarnings = options.allowParseWarnings === true;
  const allowConflicts = options.allowConflicts === true;

  const reasons = [];
  if (result.coverageReport.unscannedReviewFiles.length > 0) {
    reasons.push(`unscanned_review_files:${result.coverageReport.unscannedReviewFiles.length}`);
  }
  if (!allowParseWarnings && result.coverageReport.filesWithParseWarnings.length > 0) {
    reasons.push(`parse_warnings:${result.coverageReport.filesWithParseWarnings.length}`);
  }
  if (result.coverageReport.reviewSources.some((entry) => entry.droppedRows > 0)) {
    reasons.push("dropped_rows_present");
  }
  const blockingConflicts = result.conflictRecords.filter((record) => record.blocking !== false);
  if (!allowConflicts && blockingConflicts.length > 0) {
    reasons.push(`conflicts:${blockingConflicts.length}`);
  }

  return {
    pass: reasons.length === 0,
    reasons,
  };
}
