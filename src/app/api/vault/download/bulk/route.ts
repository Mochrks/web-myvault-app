import { PassThrough, Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { ZipArchive, type ArchiverError } from "archiver";
import { apiError, handleRouteError } from "@/lib/api/response";
import { requireApiSession } from "@/lib/auth/require-session";
import { VaultService } from "@/lib/metadata/vault-service";
import { getBlobStorageAdapter } from "@/lib/storage/blob-storage";
import { bulkDownloadSchema } from "@/lib/validation/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BULK_FILES = 250;

function getMaxBulkDownloadBytes(): number {
  const raw = process.env.MAX_BULK_DOWNLOAD_MB;
  const parsed = raw ? Number.parseInt(raw, 10) : 300;
  const mb = Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
  return mb * 1024 * 1024;
}

const ALREADY_COMPRESSED_EXTS = new Set([
  "zip",
  "gz",
  "tgz",
  "bz2",
  "xz",
  "7z",
  "rar",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "avif",
  "mp4",
  "webm",
  "mp3",
  "pdf",
  "docx",
  "xlsx",
  "pptx",
]);

function buildArchiveFilename(customName?: string): string {
  const base = customName
    ? customName.replace(/\.zip$/i, "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim()
    : `myvault-export-${new Date().toISOString().slice(0, 10)}`;
  const safeBase = base || "myvault-export";
  return `${safeBase}.zip`;
}

export async function POST(request: Request) {
  try {
    await requireApiSession();

    const body = await request.json().catch(() => null);
    const parsed = bulkDownloadSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message || "Invalid bulk download request.",
        400
      );
    }

    const service = new VaultService();
    const { entries, emptyFolderPaths, totalBytes } =
      await service.collectDownloadEntries({
        fileIds: parsed.data.fileIds,
        folderIds: parsed.data.folderIds,
      });

    if (entries.length === 0 && emptyFolderPaths.length === 0) {
      return apiError(
        "EMPTY_ARCHIVE",
        "No downloadable files found in the selected items.",
        400
      );
    }

    if (entries.length > MAX_BULK_FILES) {
      return apiError(
        "BULK_LIMIT_EXCEEDED",
        `Bulk download supports up to ${MAX_BULK_FILES} files at once (${entries.length} selected).`,
        413
      );
    }

    const maxBytes = getMaxBulkDownloadBytes();
    if (totalBytes > maxBytes) {
      const maxMb = Math.round(maxBytes / (1024 * 1024));
      return apiError(
        "BULK_SIZE_EXCEEDED",
        `Selected files exceed the ${maxMb} MB bulk download limit.`,
        413
      );
    }

    const storage = getBlobStorageAdapter();
    const archive = new ZipArchive({ zlib: { level: 6 } });
    const passThrough = new PassThrough();

    archive.on("warning", (err: ArchiverError) => {
      if (err.code !== "ENOENT") {
        passThrough.destroy(err);
      }
    });
    archive.on("error", (err: ArchiverError) => {
      passThrough.destroy(err);
    });
    archive.pipe(passThrough);

    // Stream objects sequentially into the ZIP archive to keep memory usage bounded
    void (async () => {
      try {
        for (const folderPath of emptyFolderPaths) {
          archive.append(Buffer.alloc(0), { name: folderPath });
        }

        for (const entry of entries) {
          const obj = await storage.getPrivateObjectStream(entry.file.objectKey);
          const nodeStream = Readable.fromWeb(
            obj.stream as unknown as NodeReadableStream
          );
          const ext = entry.file.extension.toLowerCase();
          archive.append(nodeStream, {
            name: entry.archivePath,
            store: ALREADY_COMPRESSED_EXTS.has(ext),
          });
        }

        await archive.finalize();
      } catch (err) {
        archive.abort();
        passThrough.destroy(
          err instanceof Error ? err : new Error("Failed while building ZIP archive.")
        );
      }
    })();

    const zipFilename = buildArchiveFilename(parsed.data.archiveName);
    const encodedName = encodeURIComponent(zipFilename);
    const fallbackAscii = zipFilename
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/"/g, "");

    const webStream = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>;

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fallbackAscii}"; filename*=UTF-8''${encodedName}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
