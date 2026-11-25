// These compile-only assertions make a future accidental DOM lib addition
// fail typecheck. They are never executed by the unit/integration runners.
// @ts-expect-error Backend code must not have browser document globals.
export type ForbiddenDocument = typeof document;
// @ts-expect-error Backend code must not have browser window globals.
export type ForbiddenWindow = typeof window;
