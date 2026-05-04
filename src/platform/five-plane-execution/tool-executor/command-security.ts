/**
 * Command Security Assessment
 *
 * ## Overview
 *
 * Provides security assessment for system commands before execution.
 * Implements multi-layer security model for the tool execution system.
 *
 * ## Key Concepts
 *
 * - **Sandbox**: Execution isolation boundary
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: sandbox}
 *
 * - **Exec Policy**: Ruleset for tool/command execution
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: exec policy}
 *
 * - **Permission**: Authorization state for subject to use capability
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: permission}
 *
 * ## Security Checks
 *
 * 1. Shell metacharacter detection - blocks |, >, <, `, &&, ||, ;, $(...)
 * 2. Inline code execution - blocks interpreters with -c/-e flags
 * 3. Remote script download - blocks curl|wget piping to shell
 * 4. Destructive command flagging - allows but marks as high risk
 *
 * @see Security Contract: docs_zh/contracts/security_contract.md
 * @see Sandbox Contract: docs_zh/contracts/sandbox_contract.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 */

import { basename } from "node:path";

// Commands that can execute arbitrary code or scripts and are considered high-risk.
const HIGH_RISK_COMMANDS = new Set(["python", "python3", "node", "bash", "sh", "zsh"]);
const SCRIPT_FILE_INTERPRETERS = new Set(["python", "python3", "node", "bash", "sh", "zsh"]);
const DURATION_ARG_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

export interface CommandPolicyDefinition {
  allowed: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
  reasonCode?: string;
  /**
   * Argument positions that are file paths to validate against sandbox policy.
   * - Positive indices (0, 1, 2...) are 0-indexed from the start of args.
   * - Negative indices (-1, -2...) count from the end (-1 = last arg, -2 = second-to-last).
   * Empty array means no args should be sandbox-path-validated.
   */
  pathArgPositions?: readonly number[];
  /** Argument positions that are file paths treated as write targets. */
  writePathArgPositions?: readonly number[];
}

const DEFAULT_COMMAND_POLICY_ENTRIES: ReadonlyArray<readonly [string, CommandPolicyDefinition]> = [
  ["pwd", { allowed: true, riskLevel: "low" }],
  ["echo", { allowed: true, riskLevel: "low" }],
  // cat/head/tail/wc/stat/realpath/readlink: arg[0] is a file path to read
  ["cat", { allowed: true, riskLevel: "low", pathArgPositions: [0] }],
  ["head", { allowed: true, riskLevel: "low", pathArgPositions: [0] }],
  ["tail", { allowed: true, riskLevel: "low", pathArgPositions: [0] }],
  ["wc", { allowed: true, riskLevel: "low", pathArgPositions: [0] }],
  ["stat", { allowed: true, riskLevel: "low", pathArgPositions: [0] }],
  ["realpath", { allowed: true, riskLevel: "low", pathArgPositions: [0] }],
  ["readlink", { allowed: true, riskLevel: "low", pathArgPositions: [0] }],
  // ls: optional path arg at [0]
  ["ls", { allowed: true, riskLevel: "low", pathArgPositions: [0] }],
  // find: optional path arg at [0]
  ["find", { allowed: true, riskLevel: "low", pathArgPositions: [0] }],
  // R30-21 FIX: grep/rg pathArgPositions should validate ALL file args, not just the last.
  // Root cause: pathArgPositions: [-1] only validated the final argument, so "grep pattern file1 file2"
  // would only check file2, allowing file1 to bypass path validation.
  // Fix: Validate all arguments after the pattern (first non-option arg) as potential file paths.
  // Note: This is conservative - it may reject some valid uses with complex option combinations,
  // but ensures all file operands are checked against the sandbox policy.
  ["grep", { allowed: true, riskLevel: "low", pathArgPositions: [1, 2, 3, 4, 5] }],
  ["rg", { allowed: true, riskLevel: "low", pathArgPositions: [1, 2, 3, 4, 5] }],
  // sort/uniq/cut: first arg is file path
  ["sort", { allowed: true, riskLevel: "low", pathArgPositions: [0] }],
  ["uniq", { allowed: true, riskLevel: "low", pathArgPositions: [0] }],
  ["cut", { allowed: true, riskLevel: "low", pathArgPositions: [0] }],
  ["sed", { allowed: true, riskLevel: "medium" }],
  ["tr", { allowed: true, riskLevel: "low" }],
  ["sleep", { allowed: true, riskLevel: "low" }],
  // R12-23 fix: env/printenv expose AA*VAULT_TOKEN/AA_SECRET* variables - blocked by default
  ["env", { allowed: false, riskLevel: "critical", reasonCode: "tool.env_blocked_exposes_secrets" }],
  ["printenv", { allowed: false, riskLevel: "critical", reasonCode: "tool.printenv_blocked_exposes_secrets" }],
  ["which", { allowed: true, riskLevel: "low" }],
  ["ps", { allowed: true, riskLevel: "medium" }],
  ["git", { allowed: true, riskLevel: "high" }],
  ["npm", { allowed: true, riskLevel: "high" }],
  ["npx", { allowed: true, riskLevel: "high" }],
  ["node", { allowed: true, riskLevel: "high" }],
  ["python", { allowed: true, riskLevel: "high" }],
  ["python3", { allowed: true, riskLevel: "high" }],
  ["bash", { allowed: true, riskLevel: "high" }],
  ["sh", { allowed: true, riskLevel: "high" }],
  ["zsh", { allowed: true, riskLevel: "high" }],
  ["cp", { allowed: true, riskLevel: "high", pathArgPositions: [0], writePathArgPositions: [1] }],
  ["mv", { allowed: true, riskLevel: "high", pathArgPositions: [0], writePathArgPositions: [1] }],
  ["rm", { allowed: true, riskLevel: "high", writePathArgPositions: [0] }],
  // R30-15/R30-16 FIX: chmod/chown writePathArgPositions should be [1], not [0].
  // Root cause: For "chmod 755 file.txt", arg[0]="755" is the mode and arg[1]="file.txt" is the path.
  // The previous config validated arg[0] (the mode) instead of arg[1] (the actual file path),
  // allowing sandbox bypass - attackers could modify arbitrary files by controlling the path arg.
  // Same issue applies to chown with "user:group file.txt" format.
  ["chmod", { allowed: true, riskLevel: "high", writePathArgPositions: [1] }],
  ["chown", { allowed: true, riskLevel: "high", writePathArgPositions: [1] }],
  // R12-22 fix: curl/wget must route through NetworkEgressPolicyService - blocked by default
  // until proper egress policy integration is implemented
  ["curl", { allowed: false, riskLevel: "critical", reasonCode: "tool.curl_blocked_requires_egress_policy" }],
  ["wget", { allowed: false, riskLevel: "critical", reasonCode: "tool.wget_blocked_requires_egress_policy" }],
  ["tar", { allowed: true, riskLevel: "high" }],
  ["unzip", { allowed: true, riskLevel: "high" }],
  ["zip", { allowed: true, riskLevel: "high" }],
  ["sqlite3", { allowed: true, riskLevel: "high" }],
  ["psql", { allowed: true, riskLevel: "high" }],
  // tee: arg[0] is a file path (writes to file)
  ["tee", { allowed: true, riskLevel: "high", writePathArgPositions: [0] }],
  ["jq", { allowed: true, riskLevel: "medium" }],
  // P2-2144: Removed duplicate touch/mkdir entries - Map takes last value so first entries were dead code
  ["touch", { allowed: true, riskLevel: "high", writePathArgPositions: [0] }],
  ["mkdir", { allowed: true, riskLevel: "high", writePathArgPositions: [0] }],
];

export function createDefaultCommandPolicies(): Map<string, CommandPolicyDefinition> {
  return new Map(DEFAULT_COMMAND_POLICY_ENTRIES);
}

// Regex pattern matching shell metacharacters: | > < ` && || ; $(...) ${...} and newlines
// S-02/S-03: Extended to cover ${} expansion, backtick `` ` `` as command substitution,
// and newline continuation attacks
// P1-2136 fix: Only block glob metacharacters when they appear in a SHELL EXPANSION context,
// not when they appear as literal arguments (e.g. "ls *.ts" has *.ts as a literal glob arg).
// The original regex wrongly blocked `ls *.ts` because `*` and `?` are glob meta-chars.
// We fix this by only matching them when preceded by a shell context marker like space,
// quote, or parenthesis. Simpler: remove [*?] from the regex since they are only dangerous
// in unquoted contexts (command substitution). The validateCommandSignature path catches
// actual injection via $() etc.
const META_SYNTAX_PATTERN = /[|><`]|&&|\|\||;|(?<!&)&(?!&)|\$\(|\$\{|\$[A-Za-z_][A-Za-z0-9_]*|(?:^|\/|\\)~(?:\/|\\|$)|\{[^}\s]*\.\.[^}\s]*\}|\[[^\]]+\]|\r|\n/;
const PATH_TRAVERSAL_PATTERN = /(?:^|[\\/])\.\.(?:[\\/]|$)|\.{4,}(?:[\\/]|$)/;

// Fork bomb detection patterns
// Classic bash fork bombs: :(){ :|:& };: or similar recursive function definitions
const FORK_BOMB_PATTERNS = [
  /:\(\)\s*\{[^}]*\|[^}]*&\s*\}\s*;\s*:/i,  // :(){ ... | ... & };:
  /\bexec\s+bash\s+-c\b/i,  // exec bash -c with inline code
  /\bfork\b/i,  // explicit fork calls
  /\$\(\s*\$\(\s*\$\(/i,  // nested command substitution (exponential growth)
  /\|.*sh\s+-c.*\|.*sh\s+-c/i,  // piped shell -c with self-reference
];

// Maximum allowed background jobs indicator (heuristic for fork bomb)
const BACKGROUND_JOB_THRESHOLD = 5;

/**
 * Result of a command security assessment.
 * Contains the decision (allowed/blocked), reason code if blocked,
 * and assessed risk level.
 */
export interface CommandAssessment {
  /** Whether the command is allowed to execute */
  allowed: boolean;

  /** Machine-readable reason code if command is blocked; null if allowed */
  reasonCode: string | null;

  /** Assessed risk level regardless of allow/block decision */
  riskLevel: "low" | "medium" | "high" | "critical";

  /** Command arguments that should be treated as sandboxed read paths */
  sandboxReadArgPaths: readonly string[];

  /** Command arguments that should be treated as sandboxed write paths */
  sandboxWriteArgPaths: readonly string[];
}

interface CachedCommandAssessment {
  assessment: CommandAssessment;
  expiresAt: number;
}

function normalizeCommandName(command: string): string {
  return basename(command).toLowerCase();
}

function unknownCommandAssessment(): CommandAssessment {
  return {
    allowed: false,
    reasonCode: "tool.command_unknown_denied",
    riskLevel: "high",
    sandboxReadArgPaths: [],
    sandboxWriteArgPaths: [],
  };
}

/**
 * Checks if the command/args combination matches fork bomb patterns.
 * Returns true if fork bomb detected.
 */
function isForkBomb(command: string, args: readonly string[]): boolean {
  const fullCommand = `${command} ${args.join(" ")}`;

  for (const pattern of FORK_BOMB_PATTERNS) {
    if (pattern.test(fullCommand)) {
      return true;
    }
  }

  // Count background job indicators (&) - excessive backgrounding suggests fork bomb
  const backgroundCount = args.filter((arg) => arg === "&").length;
  if (backgroundCount >= BACKGROUND_JOB_THRESHOLD) {
    return true;
  }

  return false;
}

function computeBaseAssessment(command: string, policies: ReadonlyMap<string, CommandPolicyDefinition>): CommandAssessment {
  const policy = policies.get(command);
  if (!policy) {
    return unknownCommandAssessment();
  }

  return {
    allowed: policy.allowed,
    reasonCode: policy.reasonCode ?? null,
    riskLevel: policy.riskLevel,
    sandboxReadArgPaths: [],
    sandboxWriteArgPaths: [],
  };
}

function deniedAssessment(
  reasonCode: string,
  riskLevel: CommandAssessment["riskLevel"],
): CommandAssessment {
  return {
    allowed: false,
    reasonCode,
    riskLevel,
    sandboxReadArgPaths: [],
    sandboxWriteArgPaths: [],
  };
}

function allowedAssessment(
  riskLevel: CommandAssessment["riskLevel"],
  sandboxReadArgPaths: readonly string[] = [],
  sandboxWriteArgPaths: readonly string[] = [],
): CommandAssessment {
  return {
    allowed: true,
    reasonCode: null,
    riskLevel,
    sandboxReadArgPaths,
    sandboxWriteArgPaths,
  };
}

function validateCommandSignature(command: string, args: readonly string[], riskLevel: CommandAssessment["riskLevel"]): CommandAssessment {
  if (command === "pwd") {
    return args.length === 0 ? allowedAssessment(riskLevel) : deniedAssessment("tool.command_arity_denied", "medium");
  }

  if (command === "sleep") {
    return args.length === 1 && DURATION_ARG_PATTERN.test(args[0] ?? "")
      ? allowedAssessment(riskLevel)
      : deniedAssessment("tool.command_signature_denied", "medium");
  }

  if (SCRIPT_FILE_INTERPRETERS.has(command)) {
    // R17-04 fix: Find the actual script path by locating the first non-flag argument,
    // not just assuming args[0] is the script. Commands like `python --verbose script.py`
    // have the script at args[1], not args[0].
    const nonFlagArgIndex = args.findIndex((arg) => !arg.startsWith("-"));
    if (nonFlagArgIndex === -1) {
      return deniedAssessment("tool.command_script_missing", "high");
    }
    const scriptPath = args[nonFlagArgIndex]!;
    // R17-04 fix: Block only when ALL args look like interpreter flags.
    // python -c "code" → blocked (all args are flags, no script)
    // python --verbose script.py → ALLOWED (script path is after flags)
    // python /path/script.py → ALLOWED (script path is normal file)
    // python --malicious-flag → blocked (no script, just flags)
    // P1-2135 fix: Check for at least one non-flag arg (the script path), not just "all args are flags".
    // "python --output foo script.py" has non-flag arg "script.py" so it's allowed.
    const allArgsAreFlags = args.every((arg) => arg.startsWith("-"));
    const hasScriptPath = args.some((arg) => !arg.startsWith("-"));
    if (allArgsAreFlags || !hasScriptPath) {
      return deniedAssessment("tool.command_interpreter_flag_denied", "critical");
    }
    return allowedAssessment(riskLevel, [scriptPath]);
  }

  return allowedAssessment(riskLevel);
}

// TOOL-02: hard upper bound on classifier cache entries. Previously the cache
// grew unbounded on high-cardinality command streams (e.g. auto-generated
// script names), producing a slow memory leak and turning the classifier into
// an amplifier for adversarial input.
const DEFAULT_CACHE_MAX_ENTRIES = 1024;

export class CommandSafetyClassifier {
  private readonly cache = new Map<string, CachedCommandAssessment>();
  private readonly maxCacheEntries: number;

  public constructor(
    private readonly options: {
      ttlMs?: number;
      now?: () => number;
      policies?: ReadonlyMap<string, CommandPolicyDefinition>;
      maxCacheEntries?: number;
    } = {},
  ) {
    this.maxCacheEntries = options.maxCacheEntries ?? DEFAULT_CACHE_MAX_ENTRIES;
  }

  public assess(command: string, args: readonly string[]): CommandAssessment {
    // Fork bomb detection - check for recursive process spawning patterns
    if (isForkBomb(command, args)) {
      return deniedAssessment("tool.fork_bomb_detected", "critical");
    }

    const normalizedCommand = normalizeCommandName(command);

    // S-05: Check for curl/wget piping to shell across separate arguments
    // before generic pipe metacharacter denial so callers receive the
    // more specific remote-script diagnostic.
    if (this.containsRemoteScriptPipe(normalizedCommand, args)) {
      return deniedAssessment("tool.remote_script_pipe_denied", "critical");
    }

    if (
      META_SYNTAX_PATTERN.test(command)
      || PATH_TRAVERSAL_PATTERN.test(command)
      || args.some((arg) => META_SYNTAX_PATTERN.test(arg) || PATH_TRAVERSAL_PATTERN.test(arg))
    ) {
      return deniedAssessment("tool.command_meta_syntax_denied", "critical");
    }

    const baseAssessment = this.getBaseAssessment(normalizedCommand);

    if (!baseAssessment.allowed) {
      return baseAssessment;
    }

    if (HIGH_RISK_COMMANDS.has(normalizedCommand) && (args[0] === "-c" || args[0] === "-e")) {
      return deniedAssessment("tool.inline_code_denied", "critical");
    }

    // Extract path arguments based on policy's pathArgPositions
    const policies = this.options.policies ?? createDefaultCommandPolicies();
    const policy = policies.get(normalizedCommand);
    const policyPathArgs = this.extractPolicyPathArgs(args, policy?.pathArgPositions);
    const policyWritePathArgs = this.extractPolicyPathArgs(args, policy?.writePathArgPositions);
    const signatureAssessment = validateCommandSignature(normalizedCommand, args, baseAssessment.riskLevel);

    // Merge path args from policy with those from validateCommandSignature (e.g., script interpreter paths)
    const allPathArgs = [...signatureAssessment.sandboxReadArgPaths, ...policyPathArgs];
    const allWritePathArgs = [...signatureAssessment.sandboxWriteArgPaths, ...policyWritePathArgs];

    return {
      ...signatureAssessment,
      sandboxReadArgPaths: allPathArgs,
      sandboxWriteArgPaths: allWritePathArgs,
    };
  }

  /**
   * Extracts file path arguments based on the policy's pathArgPositions specification.
   * Supports both positive (from start) and negative (from end) indices.
   */
  private extractPolicyPathArgs(args: readonly string[], pathArgPositions?: readonly number[]): readonly string[] {
    if (!pathArgPositions || pathArgPositions.length === 0) {
      return [];
    }

    const extracted: string[] = [];
    for (const pos of pathArgPositions) {
      // Negative indices count from the end (-1 = last arg)
      const index = pos < 0 ? args.length + pos : pos;
      if (index >= 0 && index < args.length) {
        const arg = args[index];
        // Only include non-flag arguments as paths (flags like -l, -n shouldn't be treated as paths)
        if (arg && !arg.startsWith("-")) {
          extracted.push(arg);
        }
      }
    }
    return extracted;
  }

  /**
   * S-05: Detects curl/wget downloading scripts piped to shell across separate arguments.
   * Original regex only matched within a single argument string.
   */
  private containsRemoteScriptPipe(command: string, args: readonly string[]): boolean {
    const tokens = [command, ...args];

    // Check inline: curl "http://..." | bash (entire pattern in one arg)
    if (tokens.some((arg) => /(?:curl|wget).+\|\s*(bash|sh)/i.test(arg))) {
      return true;
    }
    // Check cross-argument: curl http://... | bash (curl in one arg, "| bash" in another)
    for (let i = 0; i < tokens.length; i++) {
      const arg = tokens[i] ?? "";
      if (/^(?:curl|wget)$/i.test(arg)) {
        for (let j = i + 1; j < tokens.length; j++) {
          const nextArg = tokens[j] ?? "";
          const followingArg = tokens[j + 1] ?? "";
          if (
            (/\|/.test(nextArg) && /\b(?:bash|sh)\b/i.test(nextArg))
            || (nextArg === "|" && /\b(?:bash|sh)\b/i.test(followingArg))
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private getBaseAssessment(command: string): CommandAssessment {
    const now = this.options.now?.() ?? Date.now();
    const cached = this.cache.get(command);
    if (cached && cached.expiresAt > now) {
      // Refresh insertion order so hot keys are kept under LRU eviction.
      this.cache.delete(command);
      this.cache.set(command, cached);
      return cached.assessment;
    }
    if (cached) {
      this.cache.delete(command);
    }

    const assessment = computeBaseAssessment(command, this.options.policies ?? createDefaultCommandPolicies());
    this.cache.set(command, {
      assessment,
      expiresAt: now + (this.options.ttlMs ?? 5 * 60_000),
    });
    while (this.cache.size > this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
    return assessment;
  }
}

const DEFAULT_COMMAND_SAFETY_CLASSIFIER = new CommandSafetyClassifier();

/**
 * Assesses a command for security risks before execution.
 *
 * @param command - The base command executable name
 * @param args - The command-line arguments
 * @returns CommandAssessment with allow/block decision and risk level
 */
export function assessCommand(command: string, args: readonly string[]): CommandAssessment {
  return DEFAULT_COMMAND_SAFETY_CLASSIFIER.assess(command, args);
}
