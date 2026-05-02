export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function parseSiteId(value: unknown): number {
  if (typeof value !== "string" || !/^\d{1,7}$/.test(value)) {
    throw new ValidationError("siteId must be a numeric string of 1-7 digits");
  }
  return Number(value);
}

export function parseTimeWindow(value: unknown, fallback = 60): number {
  if (value === undefined || value === "") return fallback;
  if (typeof value !== "string" || !/^\d{1,4}$/.test(value)) {
    throw new ValidationError("timeWindow must be 1-1440");
  }
  const n = Number(value);
  if (n < 1 || n > 1440) {
    throw new ValidationError("timeWindow must be 1-1440");
  }
  return n;
}

const MAX_QUERY_LEN = 80;
export function parseSearchQuery(value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError("query is required");
  }
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError("query is required");
  if (trimmed.length > MAX_QUERY_LEN) {
    throw new ValidationError(`query must be <= ${MAX_QUERY_LEN} characters`);
  }
  return trimmed;
}
