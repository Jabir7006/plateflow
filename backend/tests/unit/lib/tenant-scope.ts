import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Static guard for the multi-tenant invariant: every Prisma read/write on a
// tenant-owned model must prove which restaurant it belongs to. This is a
// deliberately reviewable check (the same reason the services thread
// `restaurantId` explicitly instead of using Prisma middleware): a person can
// read this file and see exactly what counts as proof.
//
// It runs in the unit suite, so forgetting `restaurantId` fails CI before a
// cross-tenant leak ships. It parses source with the TypeScript compiler API —
// no database, no network, no generated-client runtime.

const BACKEND_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SRC_ROOT = path.join(BACKEND_ROOT, "src");

// Models that own rows directly. A query on one of these must be scoped.
const TENANT_MODELS = new Set(["user", "menuItem", "menuCategory", "table", "order"]);

// Models with no `restaurantId` of their own. They inherit tenancy through a
// parent, so they are never scoped directly (and should only be reached through
// that parent). `restaurant` is the tenant root itself; the two token tables are
// global by design.
const EXEMPT_MODELS = new Set([
  "restaurant",
  "verificationToken",
  "refreshToken",
]);

// Child models inherit the tenant from their parent. A standalone query would
// otherwise read every restaurant's rows, so it must prove the parent's tenant
// (or set the parent FK when creating).
const INDIRECT_MODELS: Record<
  string,
  {
    anchors: readonly (readonly string[])[];
    parentKeys: readonly (readonly string[])[];
    parentLabel: string;
  }
> = {
  orderItem: {
    anchors: [["order", "restaurantId"], ["order", "restaurant", "id"]],
    parentKeys: [["orderId"], ["order"]],
    parentLabel: "order",
  },
  menuItemSize: {
    anchors: [["menuItem", "restaurantId"], ["menuItem", "restaurant", "id"]],
    parentKeys: [["menuItemId"], ["menuItem"]],
    parentLabel: "menuItem",
  },
};

// Re-pointing a row at another restaurant (or another tenant's parent) is never
// an ordinary update: it would move data across the isolation boundary.
const UPDATE_METHODS = new Set([
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
]);

const CREATE_METHODS = new Set(["create", "createMany", "createManyAndReturn"]);
const WHERE_METHODS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);
const RAW_METHODS = new Set([
  "$queryRaw",
  "$queryRawUnsafe",
  "$executeRaw",
  "$executeRawUnsafe",
]);
const IGNORED_METHODS = new Set(["$transaction", "fields"]);

// The public diner anchor: a table's QR token resolves exactly one row, hence
// exactly one restaurant. `Order` can also be reached through that table.
const RELATION_ANCHORS: Record<string, readonly (readonly string[])[]> = {
  table: [["qrCode"], ["restaurantId"], ["restaurant", "id"]],
  order: [
    ["table", "qrCode"],
    ["table", "restaurantId"],
    ["restaurant", "id"],
  ],
};

export interface ScopeAllowlistEntry {
  /** Path relative to `backend/`, forward slashes. */
  file: string;
  /** Nearest named enclosing function/method, e.g. `login` or `updateOrderStatus`. */
  functionName: string;
  model: string;
  method: string;
  /** `where` or `data` — which clause the exception applies to. */
  kind: "where" | "data";
  /** Sorted top-level keys, so a differently-shaped call does not inherit the exception. */
  keys: readonly string[];
  /** Why a global read is safe here. Required so the exception documents itself. */
  reason: string;
}

// Every entry is a query that is *intentionally* global, not a query that
// forgot its scope. The guard fails if an entry stops matching (`stale`), so
// deleting or reshaping a call forces this list to be revisited.
const DEFAULT_ALLOWLIST: readonly ScopeAllowlistEntry[] = [
  {
    file: "src/modules/auth/auth.service.ts",
    functionName: "login",
    model: "user",
    method: "findUnique",
    kind: "where",
    keys: ["email"],
    reason: "Login: email is globally unique by product decision (one account per person).",
  },
  {
    file: "src/modules/auth/auth.service.ts",
    functionName: "getMe",
    model: "user",
    method: "findUnique",
    kind: "where",
    keys: ["id"],
    reason: "Session restore: id comes from the verified access token, before tenant context is rebuilt.",
  },
  {
    file: "src/modules/auth/auth.service.ts",
    functionName: "acceptInvite",
    model: "user",
    method: "update",
    kind: "where",
    keys: ["id"],
    reason: "Invite acceptance: id comes from the single-use, hash-checked invitation claimed in the same transaction.",
  },
  {
    file: "src/modules/staff/staff.service.ts",
    functionName: "invite",
    model: "user",
    method: "findUnique",
    kind: "where",
    keys: ["email"],
    reason: "Cross-tenant invite guard: must look up the globally unique email to refuse another restaurant's account.",
  },
];

interface Binding {
  name: string;
  initializer: ts.Expression;
  scope: ts.Node;
}

export interface Violation {
  file: string;
  line: number;
  functionName: string;
  model: string;
  method: string;
  kind: "where" | "data";
  keys: string[] | null;
  message: string;
}

export interface ScopeScanResult {
  violations: Violation[];
  unusedAllowlist: ScopeAllowlistEntry[];
  duplicateAllowlist: ScopeAllowlistEntry[];
  filesScanned: number;
}

interface SourceContext {
  file: string;
  sourceFile: ts.SourceFile;
  aliases: Set<string>;
  bindings: Binding[];
}

export function analyzeTenantScopes(
  allowlist: readonly ScopeAllowlistEntry[] = DEFAULT_ALLOWLIST,
  srcRoot = SRC_ROOT
): ScopeScanResult {
  const files = collectSourceFiles(srcRoot);

  // Track allowlist usage across the whole scan so a stale exception fails too.
  const usage = new Map<ScopeAllowlistEntry, number>(
    allowlist.map((entry) => [entry, 0])
  );
  const duplicates = findDuplicates(allowlist);

  const violations: Violation[] = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    violations.push(
      ...analyzeSource(path.relative(BACKEND_ROOT, file).split(path.sep).join("/"), source, usage)
    );
  }

  return {
    violations,
    unusedAllowlist: [...usage.entries()]
      .filter(([, count]) => count === 0)
      .map(([entry]) => entry),
    duplicateAllowlist: duplicates,
    filesScanned: files.length,
  };
}

/** Analyzes one source string. Exported so the guard itself can be tested. */
export function analyzeSource(
  file: string,
  source: string,
  usage?: Map<ScopeAllowlistEntry, number>
): Violation[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS
  );

  const aliases = new Set(["prisma", "tx"]);
  collectTransactionClientAliases(sourceFile, aliases);

  const bindings: Binding[] = [];
  collectBindings(sourceFile, sourceFile, bindings);

  const context: SourceContext = { file, sourceFile, aliases, bindings };
  const violations: Violation[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const call = readPrismaCall(node, context);
      if (call) violations.push(...checkCall(call, context, usage));
    }

    // `prisma.$queryRaw`\`…\`` is a tagged template, not a call expression.
    if (ts.isTaggedTemplateExpression(node)) {
      const tag = node.tag;
      if (
        ts.isPropertyAccessExpression(tag) &&
        ts.isIdentifier(tag.expression) &&
        context.aliases.has(tag.expression.text) &&
        RAW_METHODS.has(tag.name.text)
      ) {
        violations.push(
          ...asViolations(
            violationAt(
              context,
              node,
              {
                model: "$raw",
                method: tag.name.text,
                kind: "where",
                keys: null,
                message: `${tag.name.text} bypasses the Prisma query builder; scope cannot be verified statically.`,
              },
              usage
            )
          )
        );
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return violations;
}

interface PrismaCall {
  node: ts.CallExpression;
  model: string;
  method: string;
}

function readPrismaCall(
  node: ts.CallExpression,
  context: SourceContext
): PrismaCall | null {
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee)) return null;

  // Raw SQL: `prisma.$queryRaw` / `$executeRaw` (and their unsafe variants).
  if (
    ts.isIdentifier(callee.expression) &&
    context.aliases.has(callee.expression.text) &&
    RAW_METHODS.has(callee.name.text)
  ) {
    return { node, model: "$raw", method: callee.name.text };
  }

  // Delegate call: `prisma.order.findMany`, `tx.user.update`, ...
  if (!ts.isPropertyAccessExpression(callee.expression)) return null;
  const modelAccess = callee.expression;
  if (!ts.isIdentifier(modelAccess.expression)) return null;
  if (!context.aliases.has(modelAccess.expression.text)) return null;

  return { node, model: modelAccess.name.text, method: callee.name.text };
}

function checkCall(
  call: PrismaCall,
  context: SourceContext,
  usage?: Map<ScopeAllowlistEntry, number>
): Violation[] {
  const { model, method } = call;

  if (model === "$raw") {
    return asViolations(
      violationAt(context, call.node, {
        model,
        method,
        kind: "where",
        keys: null,
        message: `${method} bypasses the Prisma query builder; scope cannot be verified statically.`,
      })
    );
  }

  if (IGNORED_METHODS.has(method)) return [];
  if (EXEMPT_MODELS.has(model)) return [];

  const args = call.node.arguments;
  const arg = args[0] ? unwrap(args[0]) : undefined;

  const indirect = INDIRECT_MODELS[model];
  if (indirect) {
    return checkIndirect(call, context, arg, indirect, usage);
  }

  if (!TENANT_MODELS.has(model)) {
    // A new tenant-owned model was added but not registered here: fail closed
    // rather than silently leaving it unscoped.
    return asViolations(
      violationAt(context, call.node, {
        model,
        method,
        kind: "where",
        keys: null,
        message: `Prisma model "${model}" is not classified as tenant-owned or exempt; update the guard.`,
      })
    );
  }

  if (CREATE_METHODS.has(method)) {
    return checkCreate(call, context, arg, usage);
  }

  if (WHERE_METHODS.has(method)) {
    const violations = checkWhere(call, context, arg, usage);

    // Upsert also creates a row, so its `create` branch must set the tenant.
    if (method === "upsert") {
      const createData = propertyValue(arg, "create", context);
      violations.push(...checkData(call, context, createData, "create", usage));
    }

    // A row must never move between tenants through an update.
    if (UPDATE_METHODS.has(method)) {
      const updateData =
        method === "upsert"
          ? propertyValue(arg, "update", context)
          : propertyValue(arg, "data", context);
      if (updateData && dataSetsTenant(updateData, context)) {
        violations.push(
          ...asViolations(
            violationAt(
              context,
              call.node,
              {
                model,
                method,
                kind: "data",
                keys: objectKeys(updateData, context),
                message:
                  "update data sets restaurantId/restaurant; moving a row across restaurants needs an explicit, reviewed exception.",
              },
              usage
            )
          )
        );
      }
    }

    return violations;
  }

  // Unknown delegate method: a future Prisma method could otherwise slip past
  // the guard. Extend the lists above when this fires.
  return asViolations(
    violationAt(context, call.node, {
      model,
      method,
      kind: "where",
      keys: null,
      message: `Unrecognized Prisma method "${method}" on tenant-owned model "${model}"; update the guard.`,
    })
  );
}

function checkWhere(
  call: PrismaCall,
  context: SourceContext,
  arg: ts.Expression | undefined,
  usage?: Map<ScopeAllowlistEntry, number>
): Violation[] {
  const where = propertyValue(arg, "where", context);
  const analysis = where ? analyzeWhere(call.model, where, context) : null;

  if (analysis?.scoped) return [];

  return asViolations(
    violationAt(context, call.node, {
      model: call.model,
      method: call.method,
      kind: "where",
      keys: analysis?.keys ?? null,
      message: analysis
        ? "no restaurant scope in the where clause."
        : "where clause could not be resolved statically.",
    }, usage)
  );
}

function checkCreate(
  call: PrismaCall,
  context: SourceContext,
  arg: ts.Expression | undefined,
  usage?: Map<ScopeAllowlistEntry, number>
): Violation[] {
  const data = propertyValue(arg, "data", context);
  const kind = call.method === "create" ? "create" : "data[]";
  return checkData(call, context, data, kind, usage);
}

function checkData(
  call: PrismaCall,
  context: SourceContext,
  data: ts.Expression | undefined,
  kind: "create" | "data[]",
  usage?: Map<ScopeAllowlistEntry, number>
): Violation[] {
  if (!data) {
    return asViolations(
      violationAt(context, call.node, {
        model: call.model,
        method: call.method,
        kind: "data",
        keys: null,
        message: "create has no data clause.",
      }, usage)
    );
  }

  const rows =
    kind === "data[]" ? resolveArray(data, context)?.elements ?? null : [data];

  if (!rows) {
    return asViolations(
      violationAt(context, call.node, {
        model: call.model,
        method: call.method,
        kind: "data",
        keys: null,
        message: "createMany data could not be resolved statically.",
      }, usage)
    );
  }

  const unscoped = rows.filter((row) => !dataSetsTenant(row, context));
  if (unscoped.length === 0) return [];

  const keys = kind === "data[]" ? null : objectKeys(data, context);
  return asViolations(
    violationAt(context, call.node, {
      model: call.model,
      method: call.method,
      kind: "data",
      keys,
      message:
        kind === "data[]"
          ? `createMany has ${unscoped.length} row(s) without restaurantId.`
          : "create does not set restaurantId (directly or through the restaurant relation).",
    }, usage)
  );
}

/**
 * Child models (OrderItem, MenuItemSize) have no `restaurantId`; a standalone
 * query must prove the parent's tenant, and a create/update must set the parent
 * FK. Nested writes under a tenant-scoped parent never reach this function.
 */
function checkIndirect(
  call: PrismaCall,
  context: SourceContext,
  arg: ts.Expression | undefined,
  spec: (typeof INDIRECT_MODELS)[string],
  usage?: Map<ScopeAllowlistEntry, number>
): Violation[] {
  const { model, method } = call;

  if (CREATE_METHODS.has(method)) {
    const data = propertyValue(arg, "data", context);
    const rows =
      method === "create"
        ? data
          ? [data]
          : null
        : data
          ? resolveArray(data, context)?.elements ?? null
          : null;

    if (!rows) {
      return asViolations(
        violationAt(
          context,
          call.node,
          {
            model,
            method,
            kind: "data",
            keys: null,
            message: "create data could not be resolved statically.",
          },
          usage
        )
      );
    }

    const unscoped = rows.filter(
      (row) =>
        !spec.parentKeys.some((path) => hasPropertyPath(row, path, context))
    );
    if (unscoped.length === 0) return [];

    return asViolations(
      violationAt(
        context,
        call.node,
        {
          model,
          method,
          kind: "data",
          keys: method === "create" ? objectKeys(data, context) : null,
          message: `create does not set its ${spec.parentLabel} (the tenant parent).`,
        },
        usage
      )
    );
  }

  if (WHERE_METHODS.has(method)) {
    const where = propertyValue(arg, "where", context);
    const violations: Violation[] = [];

    if (!where || !spec.anchors.some((path) => hasPositivePath(where, path, context))) {
      violations.push(
        ...asViolations(
          violationAt(
            context,
            call.node,
            {
              model,
              method,
              kind: "where",
              keys: where ? objectKeys(where, context) : null,
              message: where
                ? `standalone query does not prove its ${spec.parentLabel}'s tenant.`
                : "where clause could not be resolved statically.",
            },
            usage
          )
        )
      );
    }

    if (method === "upsert") {
      const createData = propertyValue(arg, "create", context);
      if (
        !createData ||
        !spec.parentKeys.some((path) => hasPropertyPath(createData, path, context))
      ) {
        violations.push(
          ...asViolations(
            violationAt(
              context,
              call.node,
              {
                model,
                method,
                kind: "data",
                keys: createData ? objectKeys(createData, context) : null,
                message: `upsert create does not set its ${spec.parentLabel} (the tenant parent).`,
              },
              usage
            )
          )
        );
      }
    }

    if (UPDATE_METHODS.has(method)) {
      const updateData =
        method === "upsert"
          ? propertyValue(arg, "update", context)
          : propertyValue(arg, "data", context);
      if (
        updateData &&
        spec.parentKeys.some((path) => hasPropertyPath(updateData, path, context))
      ) {
        violations.push(
          ...asViolations(
            violationAt(
              context,
              call.node,
              {
                model,
                method,
                kind: "data",
                keys: objectKeys(updateData, context),
                message: `update re-parents a ${model}; that can move it to another restaurant.`,
              },
              usage
            )
          )
        );
      }
    }

    return violations;
  }

  return asViolations(
    violationAt(
      context,
      call.node,
      {
        model,
        method,
        kind: "where",
        keys: null,
        message: `Unrecognized Prisma method "${method}" on child model "${model}"; update the guard.`,
      },
      usage
    )
  );
}

/** Property-path existence (non-undefined), without requiring an exact value. */
function hasPropertyPath(
  node: ts.Expression,
  path: readonly string[],
  context: SourceContext,
  seen: Set<ts.Node> = new Set()
): boolean {
  const [head, ...rest] = path;
  if (head === undefined) return false;

  const object = resolveObject(node, context, seen);
  if (!object) return false;

  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      if (hasPropertyPath(property.expression, path, context, seen)) return true;
      continue;
    }

    if (propertyName(property) !== head) continue;

    if (ts.isShorthandPropertyAssignment(property)) return rest.length === 0;

    if (ts.isPropertyAssignment(property)) {
      if (rest.length === 0) return !isUndefinedLiteral(property.initializer);
      return hasPropertyPath(property.initializer, rest, context, seen);
    }
  }

  return false;
}

function analyzeWhere(
  model: string,
  where: ts.Expression,
  context: SourceContext
): { scoped: boolean; keys: string[] | null } {
  const keys = objectKeys(where, context);

  // A positive `restaurantId` filter (or one inside AND/OR that still confines
  // every branch) is the primary proof.
  if (provesRestaurantScope(where, context)) {
    return { scoped: true, keys };
  }

  // Relation anchors: the QR token resolves the tenant for public diner calls,
  // and a relation to the restaurant root is equally explicit.
  for (const anchor of RELATION_ANCHORS[model] ?? []) {
    if (hasPositivePath(where, anchor, context)) {
      return { scoped: true, keys };
    }
  }

  return { scoped: false, keys };
}

/**
 * True when the expression confines the row set to one restaurant.
 *
 * Deliberately conservative: a positive `restaurantId` property, or an `AND`
 * with at least one scoped conjunct, or an `OR` whose every branch is scoped.
 * `NOT` is ignored (a negated tenant filter widens the set), and a negated
 * `restaurantId` (`{ not: … }` / `{ notIn: … }`) is not proof.
 */
function provesRestaurantScope(
  node: ts.Expression,
  context: SourceContext,
  seen: Set<ts.Node> = new Set()
): boolean {
  const object = resolveObject(node, context, seen);
  if (!object) return false;

  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      if (provesRestaurantScope(property.expression, context, seen)) return true;
      continue;
    }

    const name = propertyName(property);
    if (name === null) continue;

    if (name === "restaurantId") {
      if (ts.isShorthandPropertyAssignment(property)) return true;
      if (
        ts.isPropertyAssignment(property) &&
        isExactTenantValue(property.initializer, context, seen)
      ) {
        return true;
      }
      continue;
    }

    if (name === "AND" && ts.isPropertyAssignment(property)) {
      const array = resolveArray(property.initializer, context, seen);
      if (array?.elements.some((element) => provesRestaurantScope(element, context, seen))) {
        return true;
      }
      continue;
    }

    if (name === "OR" && ts.isPropertyAssignment(property)) {
      const array = resolveArray(property.initializer, context, seen);
      if (
        array &&
        array.elements.length > 0 &&
        array.elements.every((element) => provesRestaurantScope(element, context, seen))
      ) {
        return true;
      }
    }
  }

  return false;
}

/** Positive property path (`table.qrCode`) — a `not` anywhere breaks the proof. */
function hasPositivePath(
  node: ts.Expression,
  path: readonly string[],
  context: SourceContext,
  seen: Set<ts.Node> = new Set()
): boolean {
  const [head, ...rest] = path;
  if (head === undefined) return false;

  const object = resolveObject(node, context, seen);
  if (!object) return false;

  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      if (hasPositivePath(property.expression, path, context, seen)) return true;
      continue;
    }

    if (propertyName(property) !== head) continue;
    if (ts.isShorthandPropertyAssignment(property)) return rest.length === 0;

    if (ts.isPropertyAssignment(property)) {
      if (rest.length === 0) {
        return isExactTenantValue(property.initializer, context, seen);
      }
      return hasPositivePath(property.initializer, rest, context, seen);
    }
  }

  return false;
}

function dataSetsTenant(node: ts.Expression, context: SourceContext): boolean {
  const object = resolveObject(node, context);
  if (!object) return false;

  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      if (dataSetsTenant(property.expression, context)) return true;
      continue;
    }

    const name = propertyName(property);
    // `restaurantId` (scalar) or `restaurant: { connect/create }` both set the tenant.
    // `undefined` is dropped by Prisma, so it would silently create an orphan.
    if (name === "restaurantId") {
      if (ts.isShorthandPropertyAssignment(property)) return true;
      if (
        ts.isPropertyAssignment(property) &&
        isExactTenantValue(property.initializer, context)
      ) {
        return true;
      }
    }
    if (name === "restaurant") {
      if (ts.isShorthandPropertyAssignment(property)) return true;
      if (ts.isPropertyAssignment(property) && !isUndefinedLiteral(property.initializer)) {
        return true;
      }
    }
  }

  return false;
}

function isUndefinedLiteral(node: ts.Expression): boolean {
  const unwrapped = unwrap(node);
  return (
    (ts.isIdentifier(unwrapped) && unwrapped.text === "undefined") ||
    ts.isVoidExpression(unwrapped)
  );
}

/**
 * True when a tenant value is an exact match, not a filter that can span
 * restaurants. `restaurantId: { notIn: [...] }` or `{ in: [...] }` would match
 * more than one tenant, so only a scalar (or `{ equals: … }`) counts as proof.
 * An identifier that resolves to no local binding is assumed to be a scalar
 * parameter — the code cannot know more, and the services type it as a string.
 */
function isExactTenantValue(
  node: ts.Expression,
  context: SourceContext,
  seen: Set<ts.Node> = new Set()
): boolean {
  if (isUndefinedLiteral(node)) return false;

  const resolved = resolveExpression(node, context, seen);
  if (!resolved || !ts.isObjectLiteralExpression(resolved)) return true;

  return (
    resolved.properties.length > 0 &&
    resolved.properties.every((property) => {
      if (!ts.isPropertyAssignment(property)) return false;
      return (
        propertyName(property) === "equals" &&
        !isUndefinedLiteral(property.initializer)
      );
    })
  );
}

function propertyValue(
  node: ts.Expression | undefined,
  name: string,
  context: SourceContext,
  seen: Set<ts.Node> = new Set()
): ts.Expression | undefined {
  if (!node) return undefined;

  const object = resolveObject(node, context, seen);
  if (!object) return undefined;

  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      const found = propertyValue(property.expression, name, context, seen);
      if (found) return found;
      continue;
    }

    if (propertyName(property) !== name) continue;

    if (ts.isShorthandPropertyAssignment(property)) return property.name;
    if (ts.isPropertyAssignment(property)) return property.initializer;
  }

  return undefined;
}

function objectKeys(
  node: ts.Expression | undefined,
  context: SourceContext,
  seen: Set<ts.Node> = new Set()
): string[] | null {
  if (!node) return null;

  const object = resolveObject(node, context, seen);
  if (!object) return null;

  const keys: string[] = [];
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      const inner = objectKeys(property.expression, context, seen);
      if (inner) keys.push(...inner);
      else keys.push("...");
      continue;
    }

    const name = propertyName(property);
    if (name !== null) keys.push(name);
  }

  return [...new Set(keys)].sort();
}

function resolveObject(
  node: ts.Expression,
  context: SourceContext,
  seen: Set<ts.Node> = new Set()
): ts.ObjectLiteralExpression | null {
  const resolved = resolveExpression(node, context, seen);
  return resolved && ts.isObjectLiteralExpression(resolved) ? resolved : null;
}

function resolveArray(
  node: ts.Expression,
  context: SourceContext,
  seen: Set<ts.Node> = new Set()
): ts.ArrayLiteralExpression | null {
  const resolved = resolveExpression(node, context, seen);
  return resolved && ts.isArrayLiteralExpression(resolved) ? resolved : null;
}

/** Follows local const/let bindings and type-only wrappers to the real expression. */
function resolveExpression(
  node: ts.Expression,
  context: SourceContext,
  seen: Set<ts.Node> = new Set()
): ts.Expression | null {
  let current: ts.Expression = node;

  while (true) {
    current = unwrap(current);
    if (seen.has(current)) return null;

    if (!ts.isIdentifier(current)) return current;

    const binding = findBinding(current, context);
    if (!binding) return null;

    seen.add(current);
    current = binding.initializer;
  }
}

function findBinding(
  reference: ts.Identifier,
  context: SourceContext
): Binding | null {
  const position = reference.getStart(context.sourceFile);
  let best: Binding | null = null;

  for (const binding of context.bindings) {
    if (binding.name !== reference.text) continue;
    if (
      position < binding.scope.getStart(context.sourceFile) ||
      position > binding.scope.getEnd()
    ) {
      continue;
    }

    if (
      !best ||
      binding.scope.getEnd() - binding.scope.getStart(context.sourceFile) <
        best.scope.getEnd() - best.scope.getStart(context.sourceFile)
    ) {
      best = binding;
    }
  }

  return best;
}

function collectBindings(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  bindings: Binding[]
): void {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer
  ) {
    bindings.push({
      name: node.name.text,
      initializer: node.initializer,
      scope: nearestFunction(node, sourceFile),
    });
  }

  ts.forEachChild(node, (child) => collectBindings(child, sourceFile, bindings));
}

function nearestFunction(node: ts.Node, sourceFile: ts.SourceFile): ts.Node {
  let current: ts.Node | undefined = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (isFunctionLike(current)) return current;
    if (ts.isBlock(current)) {
      // A block inside a function is still inside that function; keep walking.
    }
    current = current.parent;
  }
  return sourceFile;
}

function collectTransactionClientAliases(
  node: ts.Node,
  aliases: Set<string>
): void {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "prisma" &&
    node.expression.name.text === "$transaction"
  ) {
    const callback = node.arguments[0] && unwrap(node.arguments[0]);
    if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
      const first = callback.parameters[0];
      if (first && ts.isIdentifier(first.name)) aliases.add(first.name.text);
    }
  }

  ts.forEachChild(node, (child) => collectTransactionClientAliases(child, aliases));
}

function functionName(node: ts.Node, sourceFile: ts.SourceFile): string {
  let current: ts.Node | undefined = node.parent;

  while (current && !ts.isSourceFile(current)) {
    if (ts.isMethodDeclaration(current) && current.name) {
      return current.name.getText(sourceFile);
    }
    if (ts.isFunctionDeclaration(current) && current.name) {
      return current.name.text;
    }
    if (
      ts.isVariableDeclaration(current) &&
      ts.isIdentifier(current.name) &&
      isFunctionExpression(current.initializer)
    ) {
      return current.name.text;
    }
    if (
      (ts.isPropertyDeclaration(current) || ts.isPropertyAssignment(current)) &&
      ts.isIdentifier(current.name) &&
      isFunctionExpression(current.initializer)
    ) {
      return current.name.text;
    }
    current = current.parent;
  }

  return "<anonymous>";
}

function asViolations(violation: Violation | null): Violation[] {
  return violation ? [violation] : [];
}

function violationAt(
  context: SourceContext,
  node: ts.Node,
  detail: Omit<Violation, "file" | "line" | "functionName" | "message"> & {
    message: string;
  },
  usage?: Map<ScopeAllowlistEntry, number>
): Violation | null {
  const functionNameValue = functionName(node, context.sourceFile);
  const line =
    context.sourceFile.getLineAndCharacterOfPosition(node.getStart(context.sourceFile))
      .line + 1;

  if (usage) {
    const match = [...usage.keys()].find(
      (entry) =>
        entry.file === context.file &&
        entry.functionName === functionNameValue &&
        entry.model === detail.model &&
        entry.method === detail.method &&
        entry.kind === detail.kind &&
        sameKeys(entry.keys, detail.keys)
    );
    if (match) {
      // An allowlisted shape is an explicit, documented exception — not a
      // violation. Mark it used so a stale exception fails the guard.
      usage.set(match, (usage.get(match) ?? 0) + 1);
      return null;
    }
  }

  return {
    file: context.file,
    line,
    functionName: functionNameValue,
    model: detail.model,
    method: detail.method,
    kind: detail.kind,
    keys: detail.keys,
    message:
      `${context.file}:${line} [${functionNameValue}] ` +
      `${detail.model}.${detail.method}: ${detail.message}`,
  };
}

function sameKeys(a: readonly string[], b: string[] | null): boolean {
  if (b === null || a.length !== b.length) return false;
  return a.every((key, index) => key === b[index]);
}

function findDuplicates(
  allowlist: readonly ScopeAllowlistEntry[]
): ScopeAllowlistEntry[] {
  const seen = new Set<string>();
  const duplicates: ScopeAllowlistEntry[] = [];

  for (const entry of allowlist) {
    const key = [
      entry.file,
      entry.functionName,
      entry.model,
      entry.method,
      entry.kind,
      entry.keys.join(","),
    ].join("\u0000");

    if (seen.has(key)) duplicates.push(entry);
    else seen.add(key);
  }

  return duplicates;
}

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "generated" || entry.name === "node_modules") continue;
      files.push(...collectSourceFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }

  return files;
}

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;

  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

function propertyName(property: ts.ObjectLiteralElementLike): string | null {
  if (
    ts.isPropertyAssignment(property) ||
    ts.isShorthandPropertyAssignment(property) ||
    ts.isMethodDeclaration(property) ||
    ts.isGetAccessorDeclaration(property) ||
    ts.isSetAccessorDeclaration(property)
  ) {
    const name = property.name;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
      return name.text;
    }
  }

  return null;
}

function isFunctionExpression(node: ts.Expression | undefined): boolean {
  return !!node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));
}

function isFunctionLike(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

export { DEFAULT_ALLOWLIST, TENANT_MODELS, EXEMPT_MODELS };
