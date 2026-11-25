import { describe, expect, it } from "vitest";
import { VaultAppError } from "@/lib/api/response";
import { VaultService } from "@/lib/metadata/vault-service";
import type { BlobStorageAdapter } from "@/lib/storage/blob-storage";

function createInMemoryStorage(): BlobStorageAdapter {
  const store = new Map<
    string,
    { body: Buffer; contentType: string; etag: string }
  >();
  let etagCounter = 1;

  return {
    async readJsonWithEtag(pathname) {
      const entry = store.get(pathname);
      if (!entry) return null;
      return { text: entry.body.toString("utf8"), etag: entry.etag };
    },
    async writeJson(pathname, content, options) {
      const existing = store.get(pathname);
      if (options?.ifMatch && existing && existing.etag !== options.ifMatch) {
        throw new VaultAppError("CONFLICT", "ETag mismatch", 409);
      }
      const etag = `etag-${etagCounter++}`;
      store.set(pathname, {
        body: Buffer.from(content, "utf8"),
        contentType: "application/json",
        etag,
      });
      return { pathname, etag };
    },
    async putPrivateObject(pathname, body, contentType) {
      const buf = typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body);
      const etag = `etag-${etagCounter++}`;
      store.set(pathname, { body: buf, contentType, etag });
      return { pathname, etag };
    },
    async getPrivateObjectStream(pathname) {
      const entry = store.get(pathname);
      if (!entry) {
        throw new VaultAppError("NOT_FOUND", "Object not found", 404);
      }
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(entry.body));
          controller.close();
        },
      });
      return {
        stream,
        size: entry.body.byteLength,
        contentType: entry.contentType,
        etag: entry.etag,
        pathname,
      };
    },
    async headPrivateObject(pathname) {
      const entry = store.get(pathname);
      if (!entry) {
        throw new VaultAppError("NOT_FOUND", "Object not found", 404);
      }
      return {
        pathname,
        size: entry.body.byteLength,
        contentType: entry.contentType,
        etag: entry.etag,
        uploadedAt: new Date(),
      };
    },
    async copyPrivateObject(fromPathname, toPathname, contentType) {
      const src = store.get(fromPathname);
      if (!src) {
        throw new VaultAppError("NOT_FOUND", "Source not found", 404);
      }
      const etag = `etag-${etagCounter++}`;
      store.set(toPathname, {
        body: Buffer.from(src.body),
        contentType: contentType ?? src.contentType,
        etag,
      });
      return { pathname: toPathname, etag };
    },
    async deletePrivateObjects(pathnames) {
      for (const p of pathnames) {
        store.delete(p);
      }
    },
  };
}

describe("VaultService CRUD and copy operations", () => {
  it("initializes metadata, creates/renames/copies/deletes folders and notes", async () => {
    const storage = createInMemoryStorage();
    const vault = new VaultService(storage);

    const initial = await vault.getMetadata();
    expect(initial.folders).toEqual([]);
    expect(initial.files).toEqual([]);

    const { folder: rootFolder } = await vault.createFolder({
      name: "Docs",
      parentId: null,
    });
    const { folder: subFolder } = await vault.createFolder({
      name: "Specs",
      parentId: rootFolder.id,
    });

    const { file: note } = await vault.createNote({
      name: "plan.md",
      folderId: subFolder.id,
      content: "# Initial Plan",
    });

    // Update note content and name
    const updated = await vault.updateFile(note.id, {
      name: "roadmap.md",
      content: "# Updated Roadmap",
    });
    expect(updated.file.name).toBe("roadmap.md");

    // Copy file into same folder -> auto "(copy)" name
    const copiedFile = await vault.copyFile(note.id, {
      targetFolderId: subFolder.id,
    });
    expect(copiedFile.file.name).toBe("roadmap (copy).md");
    expect(copiedFile.file.objectKey).not.toBe(note.objectKey);

    // Prevent copying folder into itself or descendant
    await expect(
      vault.copyFolder(rootFolder.id, { targetParentId: subFolder.id })
    ).rejects.toThrow();

    // Deep copy folder into root
    const copiedFolder = await vault.copyFolder(rootFolder.id, {
      targetParentId: null,
    });
    expect(copiedFolder.folder.name).toBe("Docs (copy)");
    expect(copiedFolder.metadata.folders.length).toBe(4);
    expect(copiedFolder.metadata.files.length).toBe(4);

    // Delete original folder recursively
    const afterDelete = await vault.deleteFolder(rootFolder.id);
    expect(afterDelete.metadata.folders.length).toBe(2);
    expect(afterDelete.metadata.files.length).toBe(2);
  });
});
