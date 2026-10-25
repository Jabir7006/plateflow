import { describe, expect, it } from "vitest";
import { randomId, sha256 } from "../../../src/utils/crypto.js";

describe("sha256", () => {
  it("matches the known digest for a fixed input", () => {
    expect(sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("is deterministic and distinguishes different inputs", () => {
    expect(sha256("token")).toBe(sha256("token"));
    expect(sha256("token")).not.toBe(sha256("token2"));
  });
});

describe("randomId", () => {
  it("returns a URL-safe value with the expected base64url length", () => {
    expect(randomId()).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(randomId()).toHaveLength(43); // 32 bytes, unpadded
    expect(randomId(8)).toHaveLength(11);
  });

  it("does not repeat across many draws", () => {
    const ids = new Set(Array.from({ length: 500 }, () => randomId()));

    expect(ids.size).toBe(500);
  });
});
