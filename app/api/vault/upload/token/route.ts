import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { getServerSession } from "@/lib/auth/session";
import { VaultService } from "@/lib/metadata/vault-service";
import { getMaxUploadSizeBytes } from "@/lib/storage/blob-storage";
import { prepareUploadSchema } from "@/lib/validation/vault";

export const runtime = "nodejs";

const OBJECT_KEY_REGEX =
  /^myvault\/objects\/\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    return apiError(
      "STORAGE_NOT_CONFIGURED",
      "Vercel Blob storage token (BLOB_READ_WRITE_TOKEN) is not configured.",
      503
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return apiError("INVALID_JSON", "Invalid upload token request.", 400);
  }

  if (body.type === "blob.generate-client-token") {
    const session = await getServerSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await getServerSession();
        if (!session) {
          throw new Error("Unauthorized");
        }

        if (!OBJECT_KEY_REGEX.test(pathname)) {
          throw new Error("Invalid upload object pathname.");
        }

        let parsedPayload: unknown = {};
        try {
          parsedPayload = clientPayload ? JSON.parse(clientPayload) : {};
        } catch {
          throw new Error("Invalid client upload metadata payload.");
        }

        const validated = prepareUploadSchema.safeParse(parsedPayload);
        if (!validated.success) {
          throw new Error(
            validated.error.issues[0]?.message ?? "Invalid upload metadata."
          );
        }

        const maxBytes = getMaxUploadSizeBytes();
        const service = new VaultService();
        await service.validateUploadTarget({
          name: validated.data.name,
          folderId: validated.data.folderId,
          size: validated.data.size,
        });

        return {
          maximumSizeInBytes: Math.min(validated.data.size || maxBytes, maxBytes),
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 15 * 60 * 1000,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to initialize upload.";
    const status = message === "Unauthorized" ? 401 : 400;
    return apiError("UPLOAD_TOKEN_ERROR", message, status);
  }
}
