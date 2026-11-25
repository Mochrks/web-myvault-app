import { z } from "zod";
import { apiError, apiSuccess, handleRouteError } from "@/lib/api/response";
import { requireApiSession } from "@/lib/auth/require-session";
import { VaultService } from "@/lib/metadata/vault-service";
import { getMaxUploadSizeBytes } from "@/lib/storage/blob-storage";
import { validateSafeEntryName } from "@/lib/validation/vault";

export const runtime = "nodejs";

const folderIdSchema = z.string().uuid("Invalid folder ID.").nullable();

export async function POST(request: Request) {
  try {
    await requireApiSession();

    const formData = await request.formData();
    const uploaded = formData.get("file");
    const rawFolderId = formData.get("folderId");

    if (!(uploaded instanceof File)) {
      return apiError("VALIDATION_ERROR", "A file must be attached.", 400);
    }

    const folderIdInput =
      typeof rawFolderId === "string" && rawFolderId.trim() !== ""
        ? rawFolderId.trim()
        : null;

    const folderParsed = folderIdSchema.safeParse(folderIdInput);
    if (!folderParsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid folder ID.", 400);
    }

    const nameCheck = validateSafeEntryName(uploaded.name);
    if (!nameCheck.valid) {
      return apiError("VALIDATION_ERROR", nameCheck.message, 400);
    }

    const maxBytes = getMaxUploadSizeBytes();
    if (uploaded.size > maxBytes) {
      return apiError(
        "FILE_TOO_LARGE",
        `File exceeds maximum allowed size of ${Math.round(maxBytes / (1024 * 1024))} MB.`,
        413
      );
    }

    const arrayBuffer = await uploaded.arrayBuffer();
    const service = new VaultService();
    const result = await service.uploadFileBuffer({
      name: nameCheck.name,
      folderId: folderParsed.data,
      data: new Uint8Array(arrayBuffer),
      mimeType: uploaded.type,
    });

    return apiSuccess(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
