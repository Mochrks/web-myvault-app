import { z } from "zod";
import {
  apiError,
  apiSuccess,
  handleRouteError,
} from "@/lib/api/response";
import { requireApiSession } from "@/lib/auth/require-session";
import { VaultService } from "@/lib/metadata/vault-service";
import { getBlobStorageAdapter } from "@/lib/storage/blob-storage";
import {
  isTextReadableFile,
  isUnsafeActiveContent,
} from "@/lib/utils/file-types";
import { highlightCodeSafe } from "@/lib/utils/shiki-highlight";

export const runtime = "nodejs";

const idParamSchema = z.string().uuid("Invalid file ID.");
const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024; // 2 MB

async function streamToBuffer(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("PREVIEW_TOO_LARGE");
      }
      chunks.push(value);
    }
  }

  return Buffer.concat(chunks);
}

export async function GET(
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

    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");
    const wantHighlight = url.searchParams.get("highlight") === "1";

    const service = new VaultService();
    const file = await service.getFileById(validId.data);
    const storage = getBlobStorageAdapter();

    if (mode === "text") {
      if (!isTextReadableFile(file.kind, file.extension)) {
        return apiError(
          "UNSUPPORTED_PREVIEW",
          "This file type cannot be previewed as text.",
          415
        );
      }
      if (file.size > MAX_TEXT_PREVIEW_BYTES) {
        return apiError(
          "PREVIEW_TOO_LARGE",
          "File is larger than 2 MB preview limit. Please download the original file.",
          413
        );
      }

      const object = await storage.getPrivateObjectStream(file.objectKey);
      let buffer: Buffer;
      try {
        buffer = await streamToBuffer(object.stream, MAX_TEXT_PREVIEW_BYTES);
      } catch (err) {
        if (err instanceof Error && err.message === "PREVIEW_TOO_LARGE") {
          return apiError(
            "PREVIEW_TOO_LARGE",
            "File is larger than 2 MB preview limit. Please download the original file.",
            413
          );
        }
        throw err;
      }

      if (buffer.includes(0)) {
        return apiError(
          "UNSUPPORTED_ENCODING",
          "File contains binary data and cannot be displayed as UTF-8 text.",
          415
        );
      }

      let content: string;
      try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        return apiError(
          "UNSUPPORTED_ENCODING",
          "File encoding is not valid UTF-8. Please download the original file.",
          415
        );
      }

      if (wantHighlight) {
        const { html, language } = await highlightCodeSafe(content, file.name);
        return apiSuccess({
          file,
          content,
          highlightedHtml: html,
          language,
        });
      }

      return apiSuccess({
        file,
        content,
        highlightedHtml: null,
        language: file.extension || "plaintext",
      });
    }

    const object = await storage.getPrivateObjectStream(file.objectKey);
    const encodedName = encodeURIComponent(file.name);
    const unsafeInline = isUnsafeActiveContent(file.extension, file.mimeType);

    if (unsafeInline) {
      return new Response(object.stream, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox; default-src 'none'",
          "Cache-Control": "private, no-store",
        },
      });
    }

    return new Response(object.stream, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType || object.contentType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
        "Content-Length": String(object.size),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
