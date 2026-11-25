/**
 * Best-effort login rate limiter for single-user serverless deployments.
 *
 * Limitation (explicitly documented per architecture constraints):
 * Because no external database or Redis store is allowed in this stack,
 * attempt counters live in per-instance memory. On Vercel serverless,
 * concurrent cold-starts or separate function instances do not share this state.
 * Even so, it provides effective protection within warm instances and local dev,
 * paired with Argon2id hashing and progressive response delays.
 */

interface AttemptRecord {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

const attempts = new Map<string, AttemptRecord>();

function pruneExpired(now: number) {
  if (attempts.size < 500) return;
  for (const [key, record] of attempts.entries()) {
    if (now - record.firstFailureAt > WINDOW_MS && record.lockedUntil <= now) {
      attempts.delete(key);
    }
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}

export function checkLoginRateLimit(ip: string, now: number = Date.now()): {
  allowed: boolean;
  retryAfterSeconds: number;
  failureCount: number;
} {
  pruneExpired(now);
  const record = attempts.get(ip);
  if (!record) {
    return { allowed: true, retryAfterSeconds: 0, failureCount: 0 };
  }

  if (record.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000),
      failureCount: record.failures,
    };
  }

  if (now - record.firstFailureAt > WINDOW_MS) {
    attempts.delete(ip);
    return { allowed: true, retryAfterSeconds: 0, failureCount: 0 };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    failureCount: record.failures,
  };
}

export function recordLoginFailure(ip: string, now: number = Date.now()): {
  locked: boolean;
  retryAfterSeconds: number;
  delayMs: number;
} {
  const existing = attempts.get(ip);
  let record: AttemptRecord;

  if (!existing || now - existing.firstFailureAt > WINDOW_MS) {
    record = {
      failures: 1,
      firstFailureAt: now,
      lockedUntil: 0,
    };
  } else {
    record = {
      ...existing,
      failures: existing.failures + 1,
    };
  }

  if (record.failures >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
  }

  attempts.set(ip, record);

  const delayMs = Math.min(record.failures * 250, 1500);
  return {
    locked: record.lockedUntil > now,
    retryAfterSeconds: record.lockedUntil > now ? Math.ceil(LOCKOUT_MS / 1000) : 0,
    delayMs,
  };
}

export function resetLoginFailures(ip: string) {
  attempts.delete(ip);
}
