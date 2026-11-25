import { apiSuccess, handleRouteError } from "@/lib/api/response";
import { getServerSession } from "@/lib/auth/session";
import { getMaxUploadSizeBytes } from "@/lib/storage/blob-storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getServerSession();
    const maxUploadSizeMb = Math.round(getMaxUploadSizeBytes() / (1024 * 1024));
    if (!session) {
      return apiSuccess({
        authenticated: false,
        expiresAt: null,
        maxUploadSizeMb,
      });
    }

    return apiSuccess({
      authenticated: true,
      expiresAt: session.exp * 1000,
      maxUploadSizeMb,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
