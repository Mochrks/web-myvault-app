import {
  apiError,
  apiSuccess,
  handleRouteError,
} from "@/lib/api/response";
import { verifyVaultPassword } from "@/lib/auth/password";
import {
  checkLoginRateLimit,
  getClientIp,
  recordLoginFailure,
  resetLoginFailures,
} from "@/lib/auth/rate-limit";
import {
  createSessionToken,
  getAuthSecret,
  getSessionMaxAgeSeconds,
  setServerSessionCookie,
} from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/vault";

export const runtime = "nodejs";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = checkLoginRateLimit(ip);
    if (!limit.allowed) {
      return apiError(
        "RATE_LIMITED",
        `Too many login attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
        429
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return apiError("INVALID_JSON", "Invalid request body.", 400);
    }

    const parsed = loginSchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid password payload.",
        400
      );
    }

    const storedHash = process.env.VAULT_PASSWORD_HASH?.trim();
    if (!storedHash) {
      return apiError(
        "AUTH_NOT_CONFIGURED",
        "Vault authentication is not configured on the server.",
        503
      );
    }

    // Validate AUTH_SECRET before issuing session
    const secret = getAuthSecret();
    const isValid = await verifyVaultPassword(storedHash, parsed.data.password);

    if (!isValid) {
      const failure = recordLoginFailure(ip);
      await sleep(failure.delayMs);
      return apiError(
        "INVALID_CREDENTIALS",
        "Invalid vault password.",
        401
      );
    }

    resetLoginFailures(ip);
    const maxAge = getSessionMaxAgeSeconds();
    const { token, payload } = createSessionToken(secret, maxAge);
    await setServerSessionCookie(token, maxAge);

    return apiSuccess({
      authenticated: true,
      expiresAt: payload.exp * 1000,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
