import { describe, expect, it } from "vitest";
import { hashVaultPassword, verifyVaultPassword } from "@/lib/auth/password";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginFailures,
} from "@/lib/auth/rate-limit";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

const TEST_SECRET = "test-secret-minimum-32-characters-long-for-hmac-sha256";

describe("auth password hashing", () => {
  it("hashes and verifies the vault password with Argon2id", async () => {
    const hash = await hashVaultPassword("BANDUNG@1933");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    await expect(verifyVaultPassword(hash, "BANDUNG@1933")).resolves.toBe(true);
    await expect(verifyVaultPassword(hash, "wrong-password")).resolves.toBe(false);
    await expect(verifyVaultPassword(hash, "")).resolves.toBe(false);
  });
});

describe("auth session tokens", () => {
  it("creates and verifies valid HMAC-SHA256 session tokens", () => {
    const now = 1_700_000_000_000;
    const { token, payload } = createSessionToken(TEST_SECRET, 3600, now);
    expect(payload.sub).toBe("vault-owner");
    expect(payload.exp - payload.iat).toBe(3600);

    const verified = verifySessionToken(token, TEST_SECRET, now + 1000);
    expect(verified).not.toBeNull();
    expect(verified?.jti).toBe(payload.jti);
  });

  it("rejects tampered or expired session tokens", () => {
    const now = 1_700_000_000_000;
    const { token } = createSessionToken(TEST_SECRET, 60, now);

    const [body, sig] = token.split(".");
    const tampered = `${body}.${sig.slice(0, -1)}x`;
    expect(verifySessionToken(tampered, TEST_SECRET, now + 1000)).toBeNull();
    expect(verifySessionToken(token, "different-secret-at-least-32-characters", now + 1000)).toBeNull();
    expect(verifySessionToken(token, TEST_SECRET, now + 120_000)).toBeNull();
  });
});

describe("login rate limiting", () => {
  it("locks out after 5 failed attempts and clears on reset", () => {
    const ip = "203.0.113.42";
    const start = 1_700_000_000_000;
    clear: {
      resetLoginFailures(ip);
      break clear;
    }

    for (let i = 0; i < 4; i++) {
      const state = recordLoginFailure(ip, start + i * 1000);
      expect(state.locked).toBe(false);
    }

    const fifth = recordLoginFailure(ip, start + 5000);
    expect(fifth.locked).toBe(true);
    expect(fifth.retryAfterSeconds).toBeGreaterThan(0);

    const check = checkLoginRateLimit(ip, start + 10_000);
    expect(check.allowed).toBe(false);

    resetLoginFailures(ip);
    expect(checkLoginRateLimit(ip, start + 10_000).allowed).toBe(true);
  });
});
