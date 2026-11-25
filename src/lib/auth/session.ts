import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "myvault_session";
const DEFAULT_MAX_AGE_SECONDS = 604800; // 7 days

export interface SessionPayload {
  sub: "vault-owner";
  iat: number; // unix seconds
  exp: number; // unix seconds
  jti: string;
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short (minimum 32 characters required)."
    );
  }
  return secret;
}

export function getSessionMaxAgeSeconds(): number {
  const raw = process.env.SESSION_MAX_AGE_SECONDS;
  if (!raw) return DEFAULT_MAX_AGE_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 60) {
    return DEFAULT_MAX_AGE_SECONDS;
  }
  return parsed;
}

function signPayload(encodedPayload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

export function createSessionToken(
  secret: string = getAuthSecret(),
  maxAgeSeconds: number = getSessionMaxAgeSeconds(),
  nowMs: number = Date.now()
): { token: string; payload: SessionPayload } {
  const iat = Math.floor(nowMs / 1000);
  const payload: SessionPayload = {
    sub: "vault-owner",
    iat,
    exp: iat + maxAgeSeconds,
    jti: crypto.randomBytes(16).toString("hex"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const signature = signPayload(encodedPayload, secret);
  return {
    token: `${encodedPayload}.${signature}`,
    payload,
  };
}

export function verifySessionToken(
  token: string | undefined | null,
  secret?: string,
  nowMs: number = Date.now()
): SessionPayload | null {
  if (!token || typeof token !== "string") return null;

  let resolvedSecret: string;
  try {
    resolvedSecret = secret ?? getAuthSecret();
  } catch {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSignature] = parts;
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = signPayload(encodedPayload, resolvedSecret);
  const providedBuf = Buffer.from(providedSignature, "utf8");
  const expectedBuf = Buffer.from(expectedSignature, "utf8");

  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const rawJson = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const parsed = JSON.parse(rawJson) as Partial<SessionPayload>;
    if (
      parsed.sub !== "vault-owner" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number" ||
      typeof parsed.jti !== "string"
    ) {
      return null;
    }

    const nowSec = Math.floor(nowMs / 1000);
    if (parsed.exp <= nowSec) {
      return null;
    }
    return parsed as SessionPayload;
  } catch {
    return null;
  }
}

export function getSessionCookieOptions(maxAgeSeconds: number) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function getServerSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function setServerSessionCookie(token: string, maxAgeSeconds: number) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearServerSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
