import { VaultAppError } from "@/lib/api/response";
import {
  getBlobStorageAdapter,
  type BlobStorageAdapter,
} from "@/lib/storage/blob-storage";
import { vaultMetadataIndexSchema } from "@/lib/validation/vault";
import type { VaultMetadataIndex } from "@/types/vault";

export const METADATA_INDEX_PATH = "myvault/metadata/vault-index.json";
export const METADATA_BACKUP_PATH = "myvault/metadata/vault-index.backup.json";

export function createEmptyMetadataIndex(now: Date = new Date()): VaultMetadataIndex {
  return {
    schemaVersion: 1,
    revision: 1,
    updatedAt: now.toISOString(),
    folders: [],
    files: [],
  };
}

export function validateMetadataInvariants(index: VaultMetadataIndex): void {
  const folderMap = new Map(index.folders.map((f) => [f.id, f]));
  const folderSiblings = new Set<string>();

  for (const folder of index.folders) {
    if (folder.parentId !== null) {
      if (folder.parentId === folder.id) {
        throw new VaultAppError(
          "CIRCULAR_HIERARCHY",
          `Folder "${folder.name}" cannot be its own parent.`,
          400
        );
      }
      if (!folderMap.has(folder.parentId)) {
        throw new VaultAppError(
          "ORPHAN_FOLDER",
          `Parent folder for "${folder.name}" does not exist.`,
          400
        );
      }

      // Cycle detection
      const visited = new Set<string>([folder.id]);
      let cursor: string | null = folder.parentId;
      while (cursor !== null) {
        if (visited.has(cursor)) {
          throw new VaultAppError(
            "CIRCULAR_HIERARCHY",
            "Circular folder hierarchy detected.",
            400
          );
        }
        visited.add(cursor);
        cursor = folderMap.get(cursor)?.parentId ?? null;
      }
    }

    const siblingKey = `${folder.parentId ?? "root"}::${folder.name.toLowerCase()}`;
    if (folderSiblings.has(siblingKey)) {
      throw new VaultAppError(
        "DUPLICATE_FOLDER_NAME",
        `A folder named "${folder.name}" already exists in this location.`,
        409
      );
    }
    folderSiblings.add(siblingKey);
  }

  const fileSiblings = new Set<string>();
  const objectKeys = new Set<string>();
  for (const file of index.files) {
    if (file.folderId !== null && !folderMap.has(file.folderId)) {
      throw new VaultAppError(
        "ORPHAN_FILE",
        `Target folder for file "${file.name}" does not exist.`,
        400
      );
    }
    const siblingKey = `${file.folderId ?? "root"}::${file.name.toLowerCase()}`;
    if (fileSiblings.has(siblingKey)) {
      throw new VaultAppError(
        "DUPLICATE_FILE_NAME",
        `A file named "${file.name}" already exists in this folder.`,
        409
      );
    }
    fileSiblings.add(siblingKey);

    if (objectKeys.has(file.objectKey)) {
      throw new VaultAppError(
        "DUPLICATE_OBJECT_KEY",
        `Duplicate storage object key detected for "${file.name}".`,
        500
      );
    }
    objectKeys.add(file.objectKey);
  }
}

export class MetadataRepository {
  constructor(
    private readonly storage: BlobStorageAdapter = getBlobStorageAdapter()
  ) {}

  private parseAndValidate(rawJson: string): VaultMetadataIndex {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new VaultAppError(
        "METADATA_CORRUPT",
        "Vault metadata JSON is corrupted and cannot be parsed.",
        500
      );
    }

    const validated = vaultMetadataIndexSchema.safeParse(parsed);
    if (!validated.success) {
      throw new VaultAppError(
        "METADATA_CORRUPT",
        "Vault metadata schema validation failed.",
        500
      );
    }

    validateMetadataInvariants(validated.data);
    return validated.data;
  }

  async readOrInitialize(): Promise<{ index: VaultMetadataIndex; etag: string }> {
    const existing = await this.storage.readJsonWithEtag(METADATA_INDEX_PATH);
    if (existing) {
      return {
        index: this.parseAndValidate(existing.text),
        etag: existing.etag,
      };
    }

    const initial = createEmptyMetadataIndex();
    try {
      const written = await this.storage.writeJson(
        METADATA_INDEX_PATH,
        JSON.stringify(initial, null, 2),
        { allowOverwrite: false }
      );
      return { index: initial, etag: written.etag };
    } catch (err) {
      if (err instanceof VaultAppError && err.code === "METADATA_CONFLICT") {
        const retryRead = await this.storage.readJsonWithEtag(METADATA_INDEX_PATH);
        if (retryRead) {
          return {
            index: this.parseAndValidate(retryRead.text),
            etag: retryRead.etag,
          };
        }
      }
      throw err;
    }
  }

  async mutate(
    mutator: (current: VaultMetadataIndex) => VaultMetadataIndex,
    options?: { backupBeforeWrite?: boolean }
  ): Promise<VaultMetadataIndex> {
    const { index: current, etag } = await this.readOrInitialize();

    const cloned = structuredClone(current);
    const candidate = mutator(cloned);
    const next: VaultMetadataIndex = {
      ...candidate,
      schemaVersion: 1,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
    };

    const validated = vaultMetadataIndexSchema.safeParse(next);
    if (!validated.success) {
      throw new VaultAppError(
        "VALIDATION_ERROR",
        validated.error.issues[0]?.message ?? "Invalid metadata mutation.",
        400
      );
    }
    validateMetadataInvariants(validated.data);

    if (options?.backupBeforeWrite) {
      try {
        await this.storage.writeJson(
          METADATA_BACKUP_PATH,
          JSON.stringify(current, null, 2),
          { allowOverwrite: true }
        );
      } catch {
        // Backup write is best-effort; do not block primary mutation if backup fails.
      }
    }

    await this.storage.writeJson(
      METADATA_INDEX_PATH,
      JSON.stringify(validated.data, null, 2),
      { ifMatch: etag, allowOverwrite: true }
    );

    return validated.data;
  }
}
