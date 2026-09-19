export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (msg = "Bad request", details?: unknown) => new ApiError(400, "BAD_REQUEST", msg, details);
export const unauthorized = (msg = "Authentication required") => new ApiError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "You do not have permission to perform this action") => new ApiError(403, "FORBIDDEN", msg);
export const notFound = (msg = "Resource not found") => new ApiError(404, "NOT_FOUND", msg);
export const conflict = (msg = "Conflict", details?: unknown) => new ApiError(409, "CONFLICT", msg, details);
export const unprocessable = (msg = "Validation failed", details?: unknown) => new ApiError(422, "VALIDATION_ERROR", msg, details);
export const tooManyRequests = (retryAfterSec: number) =>
  new ApiError(429, "RATE_LIMITED", "Too many requests, please retry later", { retryAfterSec });
