import { StructuredLogger, type StructuredLoggerOptions } from "./structured-logger.js";

export function createLazyStructuredLogger(options: StructuredLoggerOptions): () => StructuredLogger {
  let logger: StructuredLogger | null = null;
  return () => {
    logger ??= new StructuredLogger(options);
    return logger;
  };
}
