import { apiSuccess, handleRouteError } from "@/lib/api/response";
import { requireApiSession } from "@/lib/auth/require-session";
import { VaultService } from "@/lib/metadata/vault-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireApiSession();
    const service = new VaultService();
    const metadata = await service.getMetadata();
    const totalBytes = metadata.files.reduce((sum, f) => sum + f.size, 0);
    return apiSuccess({
      metadata,
      stats: {
        totalFolders: metadata.folders.length,
        totalFiles: metadata.files.length,
        totalBytes,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
