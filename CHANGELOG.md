# Changelog

All notable changes to `@munesoft/api-normalizer` will be documented here.

This project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.0.0] — 2024-01-01

### Added
- **`normalize(data, schema, options?)`** — core normalization function supporting plain objects and arrays
- **Schema mapping engine** — shorthand `string[]` and full `FieldMapping` descriptor
- **Dot-notation nested access** — e.g. `"user.address.city"`
- **Default values** — per-field fallback when no candidate key resolves
- **Type coercion** — `"number"`, `"string"`, `"boolean"`, `"date"`, `"auto"`
- **Strict mode** — `options.strict` throws on missing `required` fields
- **`logDiff`** — attach a `_diff` array to the result for debugging
- **`inferSchema`** — auto-generate a starter schema from a sample response
- **Plugin system** — `options.plugins` pipeline for post-processing
- **Full TypeScript support** — generics, exported types, declaration maps
- **Zero dependencies** — works in Node.js ≥ 14 and all modern browsers
- 38 passing tests covering all features and real-world scenarios
