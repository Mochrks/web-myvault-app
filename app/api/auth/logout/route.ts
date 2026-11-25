import { apiSuccess, handleRouteError } from "@/lib/api/response";
import { clearServerSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearServerSessionCookie();
    return apiSuccess({ authenticated: false });
  } catch (error) {
    return handleRouteError(error);
  }
}
