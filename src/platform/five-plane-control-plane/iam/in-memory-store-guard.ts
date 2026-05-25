import { ValidationError } from "../../contracts/errors.js";

export function assertInMemoryStoreAllowed(envVarName: string, errorCode: string, storeDescription: string): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  if (process.env[envVarName] === "1") {
    return;
  }
  throw new ValidationError(
    errorCode,
    `In-memory ${storeDescription} is not allowed in production without explicit opt-in.`,
  );
}
