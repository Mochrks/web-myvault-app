import { z } from "zod";
import { apiError, apiSuccess, handleRouteError } from "@/lib/api/response";
import { requireApiSession } from "@/lib/auth/require-session";
import { VaultService } from "@/lib/metadata/vault-service";
import { copyFolderSchema } from "@/lib/validation/vault";

export const runtime = "nodejs";

const idParamSchema = z.string().uuid("Invalid folder ID.");

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiSession();
    const { id } = await context.params;
    const validId = idParamSchema.safeParse(id);
    if (!validId.success) {
      return apiError("VALIDATION_ERROR", "Invalid folder ID.", 400);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
    }

    const parsed = copyFolderSchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid folder copy payload.",
        400
      );
    }

    const service = new VaultService();
    const result = await service.copyFolder(validId.data, parsed.data);
    return apiSuccess(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
