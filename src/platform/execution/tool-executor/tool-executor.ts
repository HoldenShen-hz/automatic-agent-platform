import type { CommandExecutionResult, CommandExecutor } from "./command-executor.js";
import {
  executeToolItemsInParallel,
  type ParallelToolExecutionResult,
  type ParallelToolExecutorOptions,
  type ToolExecutionItem,
} from "./tool-parallel-executor.js";
import type { CommandToolRequest } from "./tool-metadata.js";

export interface ToolExecutorOptions {
  readonly commandExecutor?: CommandExecutor;
  readonly parallelOptions?: ParallelToolExecutorOptions;
}

export class ToolExecutor {
  private readonly parallelOptions: ParallelToolExecutorOptions;

  public constructor(
    private readonly commandExecutor: CommandExecutor,
    options: Omit<ToolExecutorOptions, "commandExecutor"> = {},
  ) {
    this.parallelOptions = options.parallelOptions ?? {};
  }

  public executeCommand(request: CommandToolRequest, signal?: AbortSignal): Promise<CommandExecutionResult> {
    return this.commandExecutor.execute(request, signal);
  }

  public executeParallel<T>(
    items: readonly ToolExecutionItem<T>[],
    options: ParallelToolExecutorOptions = {},
  ): Promise<ParallelToolExecutionResult<T>> {
    return executeToolItemsInParallel(items, { ...this.parallelOptions, ...options });
  }
}
