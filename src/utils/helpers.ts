// ─────────────────────────────────────────────────────────────────────────────
// @munesoft/api-normalizer — Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely retrieve a value from an object using a dot-notation path.
 *
 * Examples:
 *   get({ a: { b: 1 } }, "a.b")  → 1
 *   get({ arr: [{ id: 5 }] }, "arr.0.id") → 5
 */
export function get(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined;

  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else if (Array.isArray(current)) {
      const index = Number(part);
      current = isNaN(index) ? undefined : (current as unknown[])[index];
    } else {
      return undefined;
    }
  }

  return current;
}

/** True when value is strictly empty (null, undefined, empty string) */
export function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/** Coerce a value to a string */
export function toString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/** Coerce a value to a number; returns NaN when not convertible */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value.trim());
    return n;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return NaN;
}

/** Coerce a value to a boolean */
export function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes") return true;
    if (lower === "false" || lower === "0" || lower === "no") return false;
  }
  return Boolean(value);
}

/** Coerce a value to an ISO 8601 date string; returns null when not parseable */
export function toDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  // Already a Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
}

/**
 * Attempt light automatic type detection from a raw value.
 * Strings that look like numbers, booleans, or ISO dates are converted.
 */
export function autoCoerce(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();

  // Boolean
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  // Number (including floats, negatives)
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (!isNaN(n)) return n;
  }

  // ISO date-like strings
  if (
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(trimmed)
  ) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  return value;
}

/** Deep-clone a plain JSON-compatible value without any dependencies */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
}

/** Check whether a value is a plain object (not an array, Date, etc.) */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}
