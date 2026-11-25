import { apiError, apiSuccess, handleRouteError } from "@/lib/api/response";
import { requireApiSession } from "@/lib/auth/require-session";
import { VaultService } from "@/lib/metadata/vault-service";
import {
  createNoteSchema,
  registerUploadedFileSchema,
} from "@/lib/validation/vault";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireApiSession();

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return apiError("INVALID_JSON", "Invalid JSON payload.", 400);
    }

    const service = new VaultService();

    if (
      typeof rawBody === "object" &&
      rawBody !== null &&
      "objectKey" in rawBody
    ) {
      const parsed = registerUploadedFileSchema.safeParse(rawBody);
      if (!parsed.success) {
        return apiError(
          "VALIDATION_ERROR",
          parsed.error.issues[0]?.message ?? "Invalid uploaded file payload.",
          400
        );
      }
      const result = await service.registerUploadedObject(parsed.data);
      return apiSuccess(result, 201);
    }

    const parsed = createNoteSchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid note payload.",
        400
      );
    }

    const result = await service.createNote(parsed.data);
    return apiSuccess(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
