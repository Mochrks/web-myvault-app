import { z } from "zod";
import { apiError, apiSuccess, handleRouteError } from "@/lib/api/response";
import { requireApiSession } from "@/lib/auth/require-session";
import { VaultService } from "@/lib/metadata/vault-service";
import { updateFileSchema } from "@/lib/validation/vault";

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
    return apiSuccess({ file });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiSession();
    const { id } = await context.params;
    const validId = idParamSchema.safeParse(id);
    if (!validId.success) {
      return apiError("VALIDATION_ERROR", "Invalid file ID.", 400);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
    }

    const parsed = updateFileSchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid file update payload.",
        400
      );
    }

    const service = new VaultService();
    const result = await service.updateFile(validId.data, parsed.data);
    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
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
    const result = await service.deleteFile(validId.data);
    return apiSuccess(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
