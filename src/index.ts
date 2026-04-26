// ─────────────────────────────────────────────────────────────────────────────
// @munesoft/api-normalizer — Public API
// ─────────────────────────────────────────────────────────────────────────────

export { normalize, inferSchema } from "./normalize";

export type {
  CoercionType,
  DiffEntry,
  FieldMapping,
  NormalizeError,
  NormalizeResult,
  NormalizerOptions,
  NormalizeSuccess,
  Plugin,
  Schema,
  SchemaField,
} from "./types";
