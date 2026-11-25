import { z } from "zod";
import { apiError, handleRouteError } from "@/lib/api/response";
import { requireApiSession } from "@/lib/auth/require-session";
import { VaultService } from "@/lib/metadata/vault-service";
import { getBlobStorageAdapter } from "@/lib/storage/blob-storage";

export const runtime = "nodejs";

const idParamSchema = z.string().uuid("Invalid file ID.");

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiSession();
    const { id } = await context.params;
    const validId = idParamSchema.safeParse(id);
    if (!validId.success) {
      return apiError("VALIDATION_ERROR", "Invalid file ID.", 400);
    }

    const service = new VaultService();
    const file = await service.getFileById(validId.data);
    const storage = getBlobStorageAdapter();
    const object = await storage.getPrivateObjectStream(file.objectKey);

    const encodedName = encodeURIComponent(file.name);
    const fallbackAscii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");

    return new Response(object.stream, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fallbackAscii}"; filename*=UTF-8''${encodedName}`,
        "Content-Length": String(object.size),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
