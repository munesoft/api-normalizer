// ─────────────────────────────────────────────────────────────────────────────
// @munesoft/api-normalizer — normalize()
// ─────────────────────────────────────────────────────────────────────────────

import { inferSchema, mapObject } from "./mapper";
import {
  NormalizeError,
  NormalizeResult,
  NormalizerOptions,
  Schema,
} from "./types";
import { isPlainObject } from "./utils/helpers";

// ─── Single Object ────────────────────────────────────────────────────────────

function normalizeSingle(
  data: unknown,
  schema: Schema,
  options: NormalizerOptions
): NormalizeResult {
  const { normalized, diff, missingRequired } = mapObject(data, schema, options);

  // Strict mode: bail on missing required fields
  if (options.strict && missingRequired.length > 0) {
    const error: NormalizeError = {
      success: false,
      error: `Missing required fields: ${missingRequired.join(", ")}`,
      missingFields: missingRequired,
    };
    return error;
  }

  // Apply plugins
  let result = normalized;
  if (options.plugins) {
    for (const plugin of options.plugins) {
      try {
        result = plugin.transform(result, data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        console.warn(`[api-normalizer] Plugin "${plugin.name}" threw: ${message}`);
      }
    }
  }

  return {
    success: true,
    data: result,
    ...(options.inferSchema ? { _schema: inferSchema(data) } : {}),
    ...(options.logDiff ? { _diff: diff } : {}),
  };
}

// ─── Array ────────────────────────────────────────────────────────────────────

function normalizeArray(
  items: unknown[],
  schema: Schema,
  options: NormalizerOptions
): NormalizeResult<unknown[]> {
  const results: Record<string, unknown>[] = [];
  const allErrors: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result = normalizeSingle(item, schema, options);

    if (!result.success) {
      if (options.strict) {
        return {
          success: false,
          error: `Item at index ${i}: ${result.error}`,
          missingFields: result.missingFields,
        };
      }
      allErrors.push(`[${i}] ${result.error}`);
      continue;
    }

    results.push(result.data as Record<string, unknown>);
  }

  return {
    success: true,
    data: results,
    ...(allErrors.length > 0 ? { _warnings: allErrors } as Record<string, unknown> : {}),
  } as NormalizeResult<unknown[]>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Normalize an API response (object or array) against a schema.
 *
 * @param data    Raw API response
 * @param schema  Field mapping schema
 * @param options Normalizer options
 */
export function normalize<T = Record<string, unknown>>(
  data: unknown,
  schema: Schema,
  options: NormalizerOptions = {}
): NormalizeResult<T> {
  // Null / undefined guard
  if (data === null || data === undefined) {
    if (options.strict) {
      return {
        success: false,
        error: "Input data is null or undefined",
      } as NormalizeError;
    }
    return { success: true, data: {} as T };
  }

  if (Array.isArray(data)) {
    return normalizeArray(data, schema, options) as NormalizeResult<T>;
  }

  if (!isPlainObject(data)) {
    return {
      success: false,
      error: `Expected a plain object or array, received: ${typeof data}`,
    };
  }

  return normalizeSingle(data, schema, options) as NormalizeResult<T>;
}

/**
 * Convenience: infer a schema from a sample API response.
 * Useful for quick exploration — refine the output before using in production.
 */
export { inferSchema } from "./mapper";
