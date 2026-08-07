export type FieldErrors = Record<string, string>;

export type ZodIssueLike = {
  path?: Array<string | number>;
  message?: string;
};

export class ApiError extends Error {
  code?: string;
  details?: ZodIssueLike[];
  status?: number;

  constructor(message: string, options?: { code?: string; details?: ZodIssueLike[]; status?: number }) {
    super(message);
    this.name = "ApiError";
    this.code = options?.code;
    this.details = options?.details;
    this.status = options?.status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function clearFieldError(errors: FieldErrors, key: string): FieldErrors {
  if (!(key in errors)) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}

export function clearAllFieldErrors(): FieldErrors {
  return {};
}

export type RequiredRule = {
  key: string;
  label?: string;
  /** Custom check; default: non-empty trimmed string / non-null */
  test?: (value: unknown) => boolean;
  message?: string;
};

export function validateRequired(
  values: Record<string, unknown>,
  rules: RequiredRule[],
): FieldErrors {
  const errors: FieldErrors = {};
  for (const rule of rules) {
    const value = values[rule.key];
    const ok = rule.test
      ? rule.test(value)
      : value != null && String(value).trim().length > 0;
    if (!ok) {
      errors[rule.key] = rule.message ?? `${rule.label ?? rule.key} is required`;
    }
  }
  return errors;
}

export function validateEmail(value: string, label = "Email"): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return `Enter a valid ${label.toLowerCase()}`;
  return null;
}

/** Flatten Zod issue paths to form field keys (last string segment, skipping body/query/params). */
export function mapApiValidationDetails(
  details: ZodIssueLike[] | undefined | null,
  aliasMap?: Record<string, string>,
): FieldErrors {
  if (!details?.length) return {};
  const skip = new Set(["body", "query", "params", "data"]);
  const errors: FieldErrors = {};
  for (const issue of details) {
    const path = (issue.path ?? []).filter((p) => typeof p === "string" || typeof p === "number");
    const stringParts = path
      .map(String)
      .filter((p) => !skip.has(p) && !/^\d+$/.test(p));
    let key = stringParts[stringParts.length - 1] ?? "";
    if (!key && path.length) key = String(path[path.length - 1]);
    if (!key) continue;
    if (aliasMap?.[key]) key = aliasMap[key]!;
    if (!errors[key]) {
      errors[key] = issue.message?.trim() || "Invalid value";
    }
  }
  return errors;
}

/** Apply API error to field errors; returns true if any field was mapped (caller may skip toast). */
export function applyApiFieldErrors(
  cause: unknown,
  setFieldErrors: (errors: FieldErrors) => void,
  aliasMap?: Record<string, string>,
): boolean {
  if (!isApiError(cause) || cause.code !== "VALIDATION_ERROR") return false;
  const mapped = mapApiValidationDetails(cause.details, aliasMap);
  if (!Object.keys(mapped).length) return false;
  setFieldErrors(mapped);
  return true;
}

export function firstFieldErrorKey(errors: FieldErrors): string | null {
  const keys = Object.keys(errors);
  return keys[0] ?? null;
}
