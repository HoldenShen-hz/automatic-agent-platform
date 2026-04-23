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
export declare function validateQuestionRequest(request: QuestionToolRequest): {
    valid: boolean;
    error?: string;
};
/**
 * Normalizes answer based on question type
 */
export declare function normalizeAnswer(answer: QuestionAnswer, questionType: QuestionType): QuestionAnswer;
/**
 * Gets the label for an answer
 */
export declare function getAnswerLabel(answer: QuestionAnswer, options: readonly QuestionOption[]): string | null;
/**
 * Question tool implementation that creates question artifacts
 * for HITL rendering. This is a read-only tool that does not
 * modify system state.
 */
export declare class QuestionToolService {
    /**
     * Creates a question for human interaction.
     * Returns the question in a format suitable for HITL rendering.
     */
    createQuestion(request: QuestionToolRequest): {
        questionId: string;
        metadata: QuestionMetadata;
        renderable: QuestionRenderable;
    };
    /**
     * Validates an answer against the question type and options
     */
    validateAnswer(answer: QuestionAnswer, questionType: QuestionType, validOptionIds: Set<string>): {
        valid: boolean;
        error?: string;
    };
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
