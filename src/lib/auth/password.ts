import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  // 2 = Argon2id (avoiding ambient const enum access under isolatedModules)
  algorithm: 2,
  memoryCost: 19456, // 19 MiB (OWASP recommended baseline)
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export function normalizePasswordHash(raw: string): string {
  let cleaned = raw.trim();
  // Strip surrounding quotes if copied from shell or .env quotes
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  // Strip backslash escapes if copied from .env.local (\$ -> $)
  if (cleaned.includes("\\$")) {
    cleaned = cleaned.replace(/\\(\$)/g, "$1");
  }
  return cleaned;
}

export async function hashVaultPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyVaultPassword(
  storedHash: string,
  candidatePassword: string
): Promise<boolean> {
  if (!storedHash || !candidatePassword) return false;
  try {
    const normalized = normalizePasswordHash(storedHash);
    return await verify(normalized, candidatePassword);
  } catch {
    return false;
  }
}
