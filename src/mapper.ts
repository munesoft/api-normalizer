// ─────────────────────────────────────────────────────────────────────────────
// @munesoft/api-normalizer — Mapper Engine
// ─────────────────────────────────────────────────────────────────────────────

import {
  CoercionType,
  DiffEntry,
  FieldMapping,
  NormalizerOptions,
  Schema,
  SchemaField,
} from "./types";
import {
  autoCoerce,
  get,
  isEmpty,
  isPlainObject,
  toBoolean,
  toDate,
  toNumber,
  toString,
} from "./utils/helpers";

// ─── Internal Helpers ────────────────────────────────────────────────────────

/** Normalise a SchemaField to the canonical FieldMapping shape */
function toFieldMapping(field: SchemaField): FieldMapping {
  if (Array.isArray(field)) {
    return { keys: field };
  }
  return field;
}

/**
 * Resolve the first matching key from `candidates` found in `data`.
 * Supports dot-notation paths for nested access.
 * Returns `{ key, value }` or `{ key: null, value: undefined }`.
 */
function resolveKey(
  data: unknown,
  candidates: string[]
): { key: string | null; value: unknown } {
  for (const candidate of candidates) {
    const value = get(data, candidate);
    if (!isEmpty(value)) {
      return { key: candidate, value };
    }
  }
  return { key: null, value: undefined };
}

/** Apply type coercion based on the CoercionType hint */
function applyCoercion(value: unknown, type: CoercionType): unknown {
  switch (type) {
    case "string":
      return toString(value);
    case "number": {
      const n = toNumber(value);
      return isNaN(n) ? value : n;
    }
    case "boolean":
      return toBoolean(value);
    case "date":
      return toDate(value);
    case "auto":
      return autoCoerce(value);
    default:
      return value;
  }
}

// ─── Core Mapper ─────────────────────────────────────────────────────────────

export interface MapResult {
  normalized: Record<string, unknown>;
  diff: DiffEntry[];
  missingRequired: string[];
}

/**
 * Map a single plain object against a schema.
 * Returns the normalized object plus diff and validation metadata.
 */
export function mapObject(
  data: unknown,
  schema: Schema,
  options: NormalizerOptions = {}
): MapResult {
  const normalized: Record<string, unknown> = {};
  const diff: DiffEntry[] = [];
  const missingRequired: string[] = [];

  for (const [outputKey, rawField] of Object.entries(schema)) {
    const mapping = toFieldMapping(rawField);
    const { keys, default: defaultValue, type, required, transform } = mapping;

    const { key: sourceKey, value: rawValue } = resolveKey(data, keys);

    let usedDefault = false;
    let resolvedValue: unknown = rawValue;

    // Fall back to default when nothing resolved
    if (isEmpty(resolvedValue)) {
      if (!isEmpty(defaultValue)) {
        resolvedValue = defaultValue;
        usedDefault = true;
      } else if (required) {
        missingRequired.push(outputKey);
        resolvedValue = null;
      } else {
        resolvedValue = null;
      }
    }

    // Type coercion
    let coerced = false;
    if (options.coerceTypes && type && !isEmpty(resolvedValue) && !usedDefault) {
      const coercedValue = applyCoercion(resolvedValue, type);
      if (coercedValue !== resolvedValue) {
        coerced = true;
        resolvedValue = coercedValue;
      }
    } else if (type && !isEmpty(resolvedValue) && !usedDefault) {
      // Always honour explicit type hint even without global coerceTypes flag
      const coercedValue = applyCoercion(resolvedValue, type);
      if (coercedValue !== resolvedValue) {
        coerced = true;
        resolvedValue = coercedValue;
      }
    }

    // Custom transform
    if (typeof transform === "function" && !isEmpty(resolvedValue)) {
      resolvedValue = transform(resolvedValue, data);
    }

    normalized[outputKey] = resolvedValue;

    if (options.logDiff) {
      diff.push({
        outputKey,
        sourceKey,
        rawValue,
        normalizedValue: resolvedValue,
        coerced,
        usedDefault,
      });
    }
  }

  return { normalized, diff, missingRequired };
}

// ─── Schema Inference ─────────────────────────────────────────────────────────

/**
 * Infer a basic schema from a sample object.
 * Each top-level key becomes a schema entry pointing to itself.
 * Nested objects use dot-notation paths.
 */
export function inferSchema(
  data: unknown,
  prefix = "",
  depth = 0
): Schema {
  const schema: Schema = {};

  if (!isPlainObject(data) || depth > 4) return schema;

  for (const [key, value] of Object.entries(data)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const outputKey = key; // top-level key as output name

    if (isPlainObject(value) && depth < 4) {
      // Recurse one level for nested objects
      const nested = inferSchema(value, fullKey, depth + 1);
      Object.assign(schema, nested);
    } else {
      schema[outputKey] = { keys: [fullKey] };
    }
  }

  return schema;
}
