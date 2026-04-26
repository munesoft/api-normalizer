// ─────────────────────────────────────────────────────────────────────────────
// @munesoft/api-normalizer — Test Suite
// ─────────────────────────────────────────────────────────────────────────────

import { inferSchema, normalize } from "../src/normalize";
import { Schema } from "../src/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const USER_SCHEMA: Schema = {
  id: ["id", "user_id", "uuid"],
  name: ["name", "full_name", "username"],
  email: ["email", "email_address", "user_email"],
};

// ─── 1. Basic Schema Mapping ─────────────────────────────────────────────────

describe("Basic schema mapping", () => {
  it("maps standard keys", () => {
    const result = normalize({ id: 1, name: "Jane", email: "j@example.com" }, USER_SCHEMA);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ id: 1, name: "Jane", email: "j@example.com" });
  });

  it("maps aliased keys (user_id → id)", () => {
    const result = normalize({ user_id: 42, full_name: "John Doe", email_address: "john@example.com" }, USER_SCHEMA);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.id).toBe(42);
    expect(result.data.name).toBe("John Doe");
    expect(result.data.email).toBe("john@example.com");
  });

  it("picks first matching key when multiple are present", () => {
    const result = normalize({ id: 1, user_id: 99, name: "Alice" }, USER_SCHEMA);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.id).toBe(1); // "id" comes before "user_id"
  });

  it("sets null for fields not found in data", () => {
    const result = normalize({ id: 5 }, USER_SCHEMA);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBeNull();
    expect(result.data.email).toBeNull();
  });
});

// ─── 2. Default Values ────────────────────────────────────────────────────────

describe("Default values", () => {
  it("returns default when key is missing", () => {
    const schema: Schema = {
      role: { keys: ["role", "user_role"], default: "viewer" },
    };
    const result = normalize({ id: 1 }, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.role).toBe("viewer");
  });

  it("does not use default when key is found", () => {
    const schema: Schema = {
      role: { keys: ["role"], default: "viewer" },
    };
    const result = normalize({ role: "admin" }, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.role).toBe("admin");
  });

  it("supports numeric and boolean defaults", () => {
    const schema: Schema = {
      count: { keys: ["count"], default: 0 },
      active: { keys: ["active"], default: false },
    };
    const result = normalize({}, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.count).toBe(0);
    expect(result.data.active).toBe(false);
  });
});

// ─── 3. Nested Object Support ─────────────────────────────────────────────────

describe("Nested object support", () => {
  it("resolves dot-notation paths", () => {
    const schema: Schema = {
      id: { keys: ["user.info.user_id", "id"] },
      city: { keys: ["user.address.city", "city"] },
    };
    const data = { user: { info: { user_id: 10 }, address: { city: "Nairobi" } } };
    const result = normalize(data, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.id).toBe(10);
    expect(result.data.city).toBe("Nairobi");
  });

  it("falls back to sibling candidate when nested path is missing", () => {
    const schema: Schema = {
      id: { keys: ["user.info.user_id", "id"] },
    };
    const result = normalize({ id: 7 }, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.id).toBe(7);
  });

  it("returns null for deeply missing nested paths", () => {
    const schema: Schema = {
      city: { keys: ["user.address.city"] },
    };
    const result = normalize({ user: {} }, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.city).toBeNull();
  });
});

// ─── 4. Array Normalization ───────────────────────────────────────────────────

describe("Array normalization", () => {
  it("normalizes an array of objects", () => {
    const items = [
      { user_id: 1, full_name: "Alice" },
      { id: 2, name: "Bob" },
      { uuid: 3, username: "Carol" },
    ];
    const result = normalize(items, USER_SCHEMA);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as unknown as Record<string, unknown>[];
    expect(data).toHaveLength(3);
    expect(data[0].id).toBe(1);
    expect(data[0].name).toBe("Alice");
    expect(data[1].id).toBe(2);
    expect(data[2].name).toBe("Carol");
  });

  it("handles empty arrays", () => {
    const result = normalize([], USER_SCHEMA);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual([]);
  });

  it("handles mixed/partial objects in arrays", () => {
    const items = [{ id: 1 }, { name: "Only name" }, {}];
    const result = normalize(items, USER_SCHEMA);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as unknown as Record<string, unknown>[];
    expect(data[0].id).toBe(1);
    expect(data[1].name).toBe("Only name");
    expect(data[2].id).toBeNull();
  });
});

// ─── 5. Type Coercion ─────────────────────────────────────────────────────────

describe("Type coercion", () => {
  it("coerces string to number", () => {
    const schema: Schema = {
      age: { keys: ["age"], type: "number" },
    };
    const result = normalize({ age: "28" }, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.age).toBe(28);
    expect(typeof result.data.age).toBe("number");
  });

  it("coerces string 'true'/'false' to boolean", () => {
    const schema: Schema = {
      active: { keys: ["active"], type: "boolean" },
      deleted: { keys: ["deleted"], type: "boolean" },
    };
    const result = normalize({ active: "true", deleted: "false" }, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.active).toBe(true);
    expect(result.data.deleted).toBe(false);
  });

  it("coerces date strings to ISO 8601", () => {
    const schema: Schema = {
      createdAt: { keys: ["created_at", "createdAt"], type: "date" },
    };
    const result = normalize({ created_at: "2024-01-15" }, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(typeof result.data.createdAt).toBe("string");
    expect(result.data.createdAt as string).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("coerces number to string", () => {
    const schema: Schema = {
      code: { keys: ["code"], type: "string" },
    };
    const result = normalize({ code: 404 }, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.code).toBe("404");
  });

  it("auto-detects numeric strings with type:auto", () => {
    const schema: Schema = {
      score: { keys: ["score"], type: "auto" },
    };
    const result = normalize({ score: "99.5" }, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.score).toBe(99.5);
  });
});

// ─── 6. Strict Mode ───────────────────────────────────────────────────────────

describe("Strict mode", () => {
  it("returns error when required field is missing in strict mode", () => {
    const schema: Schema = {
      id: { keys: ["id"], required: true },
      name: { keys: ["name"] },
    };
    const result = normalize({ name: "Bob" }, schema, { strict: true });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.missingFields).toContain("id");
  });

  it("succeeds when all required fields are present", () => {
    const schema: Schema = {
      id: { keys: ["id"], required: true },
      name: { keys: ["name"], required: true },
    };
    const result = normalize({ id: 1, name: "Alice" }, schema, { strict: true });
    expect(result.success).toBe(true);
  });

  it("returns error for null data in strict mode", () => {
    const result = normalize(null, USER_SCHEMA, { strict: true });
    expect(result.success).toBe(false);
  });

  it("returns empty object for null data in non-strict mode", () => {
    const result = normalize(null, USER_SCHEMA);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({});
  });
});

// ─── 7. Edge Cases ────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("handles undefined input gracefully", () => {
    const result = normalize(undefined, USER_SCHEMA);
    expect(result.success).toBe(true);
  });

  it("handles empty object", () => {
    const result = normalize({}, USER_SCHEMA);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.id).toBeNull();
  });

  it("ignores extra keys not in schema", () => {
    const result = normalize({ id: 1, unrelated: "foo", nested: { deep: true } }, USER_SCHEMA);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect("unrelated" in result.data).toBe(false);
    expect("nested" in result.data).toBe(false);
  });

  it("handles non-object primitive data", () => {
    const result = normalize("just a string" as unknown, USER_SCHEMA);
    expect(result.success).toBe(false);
  });

  it("handles keys with value 0 (falsy but valid)", () => {
    const schema: Schema = { count: { keys: ["count"] } };
    // 0 is falsy — our isEmpty check should NOT treat it as missing
    const result = normalize({ count: 0 }, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    // 0 is a legitimate value; it passes isEmpty (empty only for null/undefined/"")
    expect(result.data.count).toBe(0);
  });
});

// ─── 8. Custom Transforms ─────────────────────────────────────────────────────

describe("Custom field transforms", () => {
  it("applies a transform function to the resolved value", () => {
    const schema: Schema = {
      name: {
        keys: ["name"],
        transform: (v) => (v as string).toUpperCase(),
      },
    };
    const result = normalize({ name: "alice" }, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBe("ALICE");
  });

  it("passes raw data as second argument to transform", () => {
    const schema: Schema = {
      displayName: {
        keys: ["first"],
        transform: (v, raw) => {
          const r = raw as Record<string, unknown>;
          return `${v} ${r.last}`;
        },
      },
    };
    const result = normalize({ first: "John", last: "Doe" }, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.displayName).toBe("John Doe");
  });
});

// ─── 9. Plugins ───────────────────────────────────────────────────────────────

describe("Plugin system", () => {
  it("runs a plugin on the normalized output", () => {
    const timestampPlugin = {
      name: "timestamp",
      transform: (data: Record<string, unknown>) => ({
        ...data,
        _processedAt: "2024-01-01T00:00:00.000Z",
      }),
    };

    const result = normalize(
      { id: 1, name: "Test" },
      USER_SCHEMA,
      { plugins: [timestampPlugin] }
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.data as Record<string, unknown>)._processedAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("chains multiple plugins in order", () => {
    const addA = {
      name: "addA",
      transform: (d: Record<string, unknown>) => ({ ...d, a: 1 }),
    };
    const addB = {
      name: "addB",
      transform: (d: Record<string, unknown>) => ({ ...d, b: (d.a as number) + 1 }),
    };

    const result = normalize({ id: 5 }, { id: ["id"] }, { plugins: [addA, addB] });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as Record<string, unknown>;
    expect(data.a).toBe(1);
    expect(data.b).toBe(2);
  });
});

// ─── 10. logDiff ─────────────────────────────────────────────────────────────

describe("logDiff option", () => {
  it("attaches _diff metadata when logDiff is true", () => {
    const result = normalize(
      { user_id: 99, full_name: "Alex" },
      USER_SCHEMA,
      { logDiff: true }
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(Array.isArray(result._diff)).toBe(true);
    const idEntry = result._diff!.find((d) => d.outputKey === "id");
    expect(idEntry?.sourceKey).toBe("user_id");
    expect(idEntry?.rawValue).toBe(99);
  });

  it("marks usedDefault in diff when field was missing", () => {
    const schema: Schema = { role: { keys: ["role"], default: "guest" } };
    const result = normalize({}, schema, { logDiff: true });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const roleEntry = result._diff!.find((d) => d.outputKey === "role");
    expect(roleEntry?.usedDefault).toBe(true);
  });
});

// ─── 11. inferSchema ─────────────────────────────────────────────────────────

describe("inferSchema", () => {
  it("generates a schema from a flat object", () => {
    const sample = { id: 1, name: "Jane", email: "jane@example.com" };
    const schema = inferSchema(sample);
    expect(schema).toHaveProperty("id");
    expect(schema).toHaveProperty("name");
    expect(schema).toHaveProperty("email");
  });

  it("attaches inferred schema to result when inferSchema option is true", () => {
    const result = normalize(
      { id: 1, name: "Jane" },
      USER_SCHEMA,
      { inferSchema: true }
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result._schema).toBeDefined();
  });
});

// ─── 12. Real-World Scenarios ─────────────────────────────────────────────────

describe("Real-world integration scenarios", () => {
  it("normalizes Stripe-like user object", () => {
    const stripeUser = {
      id: "cus_xyz",
      object: "customer",
      email: "billing@company.com",
      name: "Company Inc.",
      created: 1700000000,
    };
    const schema: Schema = {
      id: ["id"],
      email: ["email"],
      name: ["name", "company_name"],
      createdAt: { keys: ["created"], type: "date" },
    };
    const result = normalize(stripeUser, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.id).toBe("cus_xyz");
    expect(typeof result.data.createdAt).toBe("string");
  });

  it("normalizes GitHub-like user object", () => {
    const ghUser = {
      login: "octocat",
      id: 583231,
      avatar_url: "https://avatars.githubusercontent.com/u/583231",
      html_url: "https://github.com/octocat",
      type: "User",
    };
    const schema: Schema = {
      id: ["id"],
      name: ["name", "login"],
      avatarUrl: ["avatar_url", "avatarUrl"],
      profileUrl: ["html_url", "profileUrl"],
    };
    const result = normalize(ghUser, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBe("octocat");
    expect(result.data.avatarUrl).toContain("githubusercontent");
  });

  it("normalizes a list of mixed-format order objects", () => {
    const orders = [
      { order_id: "A1", total_amount: "49.99", status: "shipped" },
      { id: "B2", amount: 129.0, order_status: "pending" },
      { orderId: "C3", price: "9.99", state: "delivered" },
    ];
    const schema: Schema = {
      id: ["id", "order_id", "orderId"],
      total: { keys: ["total_amount", "amount", "price"], type: "number" },
      status: ["status", "order_status", "state"],
    };
    const result = normalize(orders, schema);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as unknown as Record<string, unknown>[];
    expect(data).toHaveLength(3);
    expect(data[0].id).toBe("A1");
    expect(data[0].total).toBe(49.99);
    expect(data[1].status).toBe("pending");
    expect(data[2].id).toBe("C3");
  });
});
