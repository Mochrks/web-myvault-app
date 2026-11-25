import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  // 2 = Argon2id (avoiding ambient const enum access under isolatedModules)
  algorithm: 2,
  memoryCost: 19456, // 19 MiB (OWASP recommended baseline)
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export async function hashVaultPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyVaultPassword(
  storedHash: string,
  candidatePassword: string
): Promise<boolean> {
  if (!storedHash || !candidatePassword) return false;
  try {
    return await verify(storedHash, candidatePassword);
  } catch {
    return false;
  }
}
