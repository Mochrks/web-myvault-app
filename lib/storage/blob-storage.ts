import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  copy,
  del,
  get,
  head,
  put,
} from "@vercel/blob";
import { VaultAppError } from "@/lib/api/response";

export interface StoredObjectHead {
  pathname: string;
  size: number;
  contentType: string;
  etag: string;
  uploadedAt: Date;
}

export interface StoredObjectRead {
  stream: ReadableStream<Uint8Array>;
  size: number;
  contentType: string;
  etag: string;
  pathname: string;
}

export interface BlobStorageAdapter {
  readJsonWithEtag(pathname: string): Promise<{ text: string; etag: string } | null>;
  writeJson(
    pathname: string,
    content: string,
    options?: { ifMatch?: string; allowOverwrite?: boolean }
  ): Promise<{ etag: string; pathname: string }>;
  putPrivateObject(
    pathname: string,
    body: Buffer | Uint8Array | string,
    contentType: string,
    options?: { allowOverwrite?: boolean }
  ): Promise<{ pathname: string; etag: string }>;
  getPrivateObjectStream(pathname: string): Promise<StoredObjectRead>;
  headPrivateObject(pathname: string): Promise<StoredObjectHead>;
  copyPrivateObject(
    fromPathname: string,
    toPathname: string,
    contentType?: string
  ): Promise<{ pathname: string; etag: string }>;
  deletePrivateObjects(pathnames: string[]): Promise<void>;
}

export function isBlobStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function assertBlobConfigured(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new VaultAppError(
      "STORAGE_NOT_CONFIGURED",
      "Vercel Blob storage token (BLOB_READ_WRITE_TOKEN) is not configured.",
      503
    );
  }
  return token;
}

async function streamToUtf8(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function createVercelBlobAdapter(): BlobStorageAdapter {
  return {
    async readJsonWithEtag(pathname: string) {
      const token = assertBlobConfigured();
      try {
        const result = await get(pathname, {
          access: "private",
          useCache: false,
          token,
        });
        if (!result || result.statusCode !== 200 || !result.stream) {
          return null;
        }
        const text = await streamToUtf8(result.stream);
        return {
          text,
          etag: result.blob.etag,
        };
      } catch (err) {
        if (err instanceof BlobNotFoundError) {
          return null;
        }
        throw new VaultAppError(
          "STORAGE_READ_ERROR",
          "Failed to read metadata from private object storage.",
          502
        );
      }
    },

    async writeJson(pathname, content, options) {
      const token = assertBlobConfigured();
      try {
        const result = await put(pathname, content, {
          access: "private",
          contentType: "application/json",
          cacheControlMaxAge: 60,
          allowOverwrite: options?.allowOverwrite ?? true,
          addRandomSuffix: false,
          ...(options?.ifMatch ? { ifMatch: options.ifMatch } : {}),
          token,
        });
        return {
          etag: result.etag,
          pathname: result.pathname,
        };
      } catch (err) {
        if (err instanceof BlobPreconditionFailedError) {
          throw new VaultAppError(
            "METADATA_CONFLICT",
            "Vault metadata was updated by another request. Please refresh and try again.",
            409
          );
        }
        const message = err instanceof Error ? err.message : "";
        if (message.toLowerCase().includes("already exists")) {
          throw new VaultAppError(
            "METADATA_CONFLICT",
            "Vault metadata already exists concurrently. Please retry.",
            409
          );
        }
        throw new VaultAppError(
          "STORAGE_WRITE_ERROR",
          "Failed to persist metadata to private object storage.",
          502
        );
      }
    },

    async putPrivateObject(pathname, body, contentType, options) {
      const token = assertBlobConfigured();
      try {
        const payload = typeof body === "string" ? body : Buffer.from(body);
        const result = await put(pathname, payload, {
          access: "private",
          contentType,
          cacheControlMaxAge: 60,
          allowOverwrite: options?.allowOverwrite ?? false,
          addRandomSuffix: false,
          token,
        });
        return {
          pathname: result.pathname,
          etag: result.etag,
        };
      } catch {
        throw new VaultAppError(
          "STORAGE_UPLOAD_ERROR",
          "Failed to store file in private object storage.",
          502
        );
      }
    },

    async getPrivateObjectStream(pathname: string) {
      const token = assertBlobConfigured();
      try {
        const result = await get(pathname, {
          access: "private",
          useCache: false,
          token,
        });
        if (!result || result.statusCode !== 200 || !result.stream) {
          throw new VaultAppError(
            "OBJECT_NOT_FOUND",
            "The requested file binary does not exist in storage.",
            404
          );
        }
        return {
          stream: result.stream,
          size: result.blob.size,
          contentType: result.blob.contentType || "application/octet-stream",
          etag: result.blob.etag,
          pathname: result.blob.pathname,
        };
      } catch (err) {
        if (err instanceof VaultAppError) throw err;
        if (err instanceof BlobNotFoundError) {
          throw new VaultAppError(
            "OBJECT_NOT_FOUND",
            "The requested file binary does not exist in storage.",
            404
          );
        }
        throw new VaultAppError(
          "STORAGE_READ_ERROR",
          "Failed to retrieve file from private object storage.",
          502
        );
      }
    },

    async headPrivateObject(pathname: string) {
      const token = assertBlobConfigured();
      try {
        const info = await head(pathname, { token });
        return {
          pathname: info.pathname,
          size: info.size,
          contentType: info.contentType,
          etag: info.etag,
          uploadedAt: info.uploadedAt,
        };
      } catch (err) {
        if (err instanceof BlobNotFoundError) {
          throw new VaultAppError(
            "OBJECT_NOT_FOUND",
            "Uploaded object could not be found in private storage.",
            404
          );
        }
        throw new VaultAppError(
          "STORAGE_READ_ERROR",
          "Failed to inspect object metadata in storage.",
          502
        );
      }
    },

    async copyPrivateObject(fromPathname, toPathname, contentType) {
      const token = assertBlobConfigured();
      try {
        const result = await copy(fromPathname, toPathname, {
          access: "private",
          allowOverwrite: false,
          addRandomSuffix: false,
          ...(contentType ? { contentType } : {}),
          token,
        });
        return {
          pathname: result.pathname,
          etag: result.etag,
        };
      } catch (err) {
        if (err instanceof BlobNotFoundError) {
          throw new VaultAppError(
            "OBJECT_NOT_FOUND",
            "Source file object does not exist in storage.",
            404
          );
        }
        throw new VaultAppError(
          "STORAGE_COPY_ERROR",
          "Failed to copy object in private storage.",
          502
        );
      }
    },

    async deletePrivateObjects(pathnames: string[]) {
      if (pathnames.length === 0) return;
      const token = assertBlobConfigured();
      try {
        await del(pathnames, { token });
      } catch (err) {
        if (err instanceof BlobNotFoundError) {
          return;
        }
        throw new VaultAppError(
          "STORAGE_DELETE_ERROR",
          "Failed to delete object(s) from private storage.",
          502
        );
      }
    },
  };
}

let defaultAdapter: BlobStorageAdapter | null = null;

export function getBlobStorageAdapter(): BlobStorageAdapter {
  if (!defaultAdapter) {
    defaultAdapter = createVercelBlobAdapter();
  }
  return defaultAdapter;
}

export function generateObjectKey(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  return `myvault/objects/${year}/${crypto.randomUUID()}`;
}

export function getMaxUploadSizeBytes(): number {
  const raw = process.env.MAX_UPLOAD_SIZE_MB;
  const mb = raw ? Number.parseInt(raw, 10) : 100;
  const safeMb = Number.isFinite(mb) && mb > 0 ? mb : 100;
  return safeMb * 1024 * 1024;
}
