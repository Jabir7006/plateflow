// Business payloads differ across endpoints (including deliberate malformed
// inputs). Keep that flexibility at this test-only transport boundary rather
// than importing DOM's Promise<any> JSON declaration into the whole backend.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TestJsonBody = Record<string, any>;

export async function readJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  return body as T;
}
