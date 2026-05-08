export interface ParsedIntentToken {
  readonly intentType: "task_create" | "task_query" | "task_modify" | "status_inquiry" | "approval_action";
  readonly confidence: number;
}

export interface ModelIntentParserPort {
  parseWithLlm(input: {
    readonly message: string;
    readonly locale: string;
  }): Promise<ParsedIntentToken | readonly ParsedIntentToken[] | null>;
}

export function parseIntentTokens(message: string): ParsedIntentToken[] {
  const normalized = message.toLowerCase();
  if (/(approve|审批|通过)/i.test(message)) {
    return [{ intentType: "approval_action", confidence: 0.92 }];
  }
  if (/(status|状态|summary|同步)/i.test(message)) {
    return [{ intentType: "status_inquiry", confidence: 0.84 }];
  }
  if (/(delete|remove|删除|修改)/i.test(message)) {
    return [{ intentType: "task_modify", confidence: 0.8 }];
  }
  if (/(create|make|生成|创建|做一个)/i.test(normalized) || normalized.length > 12) {
    return [{ intentType: "task_create", confidence: 0.88 }];
  }
  return [{ intentType: "task_query", confidence: 0.62 }];
}

export async function parseIntentTokensWithModel(
  message: string,
  options: {
    readonly locale?: string;
    readonly parser?: ModelIntentParserPort | null;
    readonly minimumConfidence?: number;
  } = {},
): Promise<ParsedIntentToken[]> {
  const heuristic = parseIntentTokens(message);
  if (options.parser == null) {
    return heuristic;
  }

  try {
    const parsed = await options.parser.parseWithLlm({
      message,
      locale: options.locale ?? "und",
    });
    const normalized = Array.isArray(parsed) ? parsed.filter(Boolean) : parsed == null ? [] : [parsed];
    const primary = normalized[0];
    if (primary == null) {
      return heuristic;
    }
    const minimumConfidence = options.minimumConfidence ?? 0.75;
    if (primary.confidence >= Math.max(minimumConfidence, heuristic[0]?.confidence ?? 0)) {
      return normalized;
    }
  } catch {
    return heuristic;
  }

  return heuristic;
}
