/**
 * Question Tool
 *
 * Provides structured question/answer capabilities with support for:
 * - Single choice questions
 * - Multiple choice questions
 * - Skippable questions (user can skip without answering)
 * - HITL (Human-In-The-Loop) rendering integration
 *
 * This tool does not modify any state - it only presents questions
 * and returns user answers.
 */

import type { ToolExecutionRequest } from "./tool-metadata.js";
import { ValidationError } from "../../contracts/errors.js";
import { coerceQuestionToolRequest } from "./tool-argument-coercion.js";

export type QuestionType = "single_choice" | "multiple_choice" | "skippable";

export interface QuestionOption {
  optionId: string;
  label: string;
  description?: string | null;
  isDefault?: boolean | null;
}

export interface QuestionToolRequest extends ToolExecutionRequest {
  question: string;
  questionType: QuestionType;
  options: readonly QuestionOption[];
  context?: string | null;
  required?: boolean | null;
  hint?: string | null;
}

export type QuestionAnswer = string | string[] | null;

export interface QuestionToolResult {
  success: boolean;
  status: "pending" | "answered" | "skipped" | "timeout" | "cancelled";
  answer: QuestionAnswer;
  answerLabel?: string | null;
  durationMs: number;
  error?: string | null;
  errorCode?: string | null;
}

export interface QuestionMetadata {
  questionType: QuestionType;
  optionsCount: number;
  contextLength?: number | null;
  timeoutMs: number;
}

/**
 * Validates that the question request is well-formed
 */
export function validateQuestionRequest(request: QuestionToolRequest): { valid: boolean; error?: string } {
  if (!request.question || request.question.trim().length === 0) {
    return { valid: false, error: "Question text is required" };
  }

  if (!request.options || request.options.length === 0) {
    return { valid: false, error: "At least one option is required" };
  }

  for (const option of request.options) {
    if (!option.optionId || option.optionId.trim().length === 0) {
      return { valid: false, error: "Option ID is required" };
    }
    if (!option.label || option.label.trim().length === 0) {
      return { valid: false, error: "Option label is required" };
    }
  }

  if (request.questionType === "single_choice") {
    const defaults = request.options.filter(o => o.isDefault === true);
    if (defaults.length > 1) {
      return { valid: false, error: "Single choice questions can only have one default option" };
    }
  }

  return { valid: true };
}

/**
 * Normalizes answer based on question type
 */
export function normalizeAnswer(
  answer: QuestionAnswer,
  questionType: QuestionType,
): QuestionAnswer {
  if (answer === null) {
    return null;
  }

  if (questionType === "single_choice") {
    if (Array.isArray(answer)) {
      return answer[0] ?? null;
    }
    return answer;
  }

  if (questionType === "multiple_choice") {
    if (Array.isArray(answer)) {
      return [...new Set(answer)];
    }
    return [answer];
  }

  return answer;
}

/**
 * Gets the label for an answer
 */
export function getAnswerLabel(answer: QuestionAnswer, options: readonly QuestionOption[]): string | null {
  if (answer === null) {
    return null;
  }

  const optionMap = new Map(options.map(o => [o.optionId, o.label]));

  if (Array.isArray(answer)) {
    const labels = answer.map(id => optionMap.get(id)).filter((l): l is string => l !== undefined);
    return labels.join(", ");
  }

  return optionMap.get(answer) ?? null;
}

/**
 * Question tool implementation that creates question artifacts
 * for HITL rendering. This is a read-only tool that does not
 * modify system state.
 */
export class QuestionToolService {
  /**
   * Creates a question for human interaction.
   * Returns the question in a format suitable for HITL rendering.
   */
  createQuestion(request: QuestionToolRequest): {
    questionId: string;
    metadata: QuestionMetadata;
    renderable: QuestionRenderable;
  } {
    const normalizedRequest = coerceQuestionToolRequest(request).value;
    const validation = validateQuestionRequest(normalizedRequest);
    if (!validation.valid) {
      throw new ValidationError("question.invalid_request", `Invalid question request: ${validation.error}`, {
        source: "tool",
        details: {
          reason: validation.error ?? "unknown",
          questionType: normalizedRequest.questionType,
        },
      });
    }

    const questionId = `q_${normalizedRequest.callId}`;
    const timeoutMs = normalizedRequest.timeoutMs ?? 300000; // 5 minute default

    const metadata: QuestionMetadata = {
      questionType: normalizedRequest.questionType,
      optionsCount: normalizedRequest.options.length,
      contextLength: normalizedRequest.context?.length ?? null,
      timeoutMs,
    };

    const renderable: QuestionRenderable = {
      questionId,
      question: normalizedRequest.question,
      questionType: normalizedRequest.questionType,
      options: normalizedRequest.options.map(o => ({
        optionId: o.optionId,
        label: o.label,
        description: o.description ?? null,
        isDefault: o.isDefault ?? false,
      })),
      context: normalizedRequest.context ?? null,
      required: normalizedRequest.required ?? true,
      hint: normalizedRequest.hint ?? null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + timeoutMs).toISOString(),
    };

    return { questionId, metadata, renderable };
  }

  /**
   * Validates an answer against the question type and options
   */
  validateAnswer(
    answer: QuestionAnswer,
    questionType: QuestionType,
    validOptionIds: Set<string>,
  ): { valid: boolean; error?: string } {
    if (answer === null) {
      return { valid: true }; // Null is always valid (represents skip or no answer)
    }

    if (questionType === "single_choice") {
      if (Array.isArray(answer)) {
        return { valid: false, error: "Single choice answer must be a single option ID" };
      }
      if (!validOptionIds.has(answer)) {
        return { valid: false, error: "Invalid option ID" };
      }
      return { valid: true };
    }

    if (questionType === "multiple_choice") {
      if (!Array.isArray(answer)) {
        return { valid: false, error: "Multiple choice answer must be an array of option IDs" };
      }
      for (const id of answer) {
        if (!validOptionIds.has(id)) {
          return { valid: false, error: `Invalid option ID: ${id}` };
        }
      }
      return { valid: true };
    }

    // skippable type allows any answer format
    return { valid: true };
  }
}

export interface QuestionRenderable {
  questionId: string;
  question: string;
  questionType: QuestionType;
  options: readonly {
    optionId: string;
    label: string;
    description: string | null;
    isDefault: boolean;
  }[];
  context: string | null;
  required: boolean;
  hint: string | null;
  createdAt: string;
  expiresAt: string;
}
