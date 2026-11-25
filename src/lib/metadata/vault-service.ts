import crypto from "node:crypto";
import { VaultAppError } from "@/lib/api/response";
import {
  MetadataRepository,
} from "@/lib/metadata/metadata-repository";
import {
  generateObjectKey,
  getBlobStorageAdapter,
  getMaxUploadSizeBytes,
  type BlobStorageAdapter,
} from "@/lib/storage/blob-storage";
import {
  detectFileKind,
  extractExtension,
  normalizeMimeType,
} from "@/lib/utils/file-types";
import type {
  VaultFile,
  VaultFolder,
  VaultMetadataIndex,
  VaultStats,
} from "@/types/vault";

export interface FolderTreeDeletePreview {
  folder: VaultFolder;
  descendantFolderIds: string[];
  files: VaultFile[];
  totalItemsToDelete: number;
}

export class VaultService {
  private readonly repo: MetadataRepository;

  constructor(private readonly storage: BlobStorageAdapter = getBlobStorageAdapter()) {
    this.repo = new MetadataRepository(storage);
  }

  async getMetadata(): Promise<VaultMetadataIndex> {
    const { index } = await this.repo.readOrInitialize();
    return index;
  }

  async getStats(): Promise<VaultStats> {
    const index = await this.getMetadata();
    const totalBytes = index.files.reduce((sum, f) => sum + f.size, 0);
    const recentFiles = [...index.files]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8);
    return {
      totalFolders: index.folders.length,
      totalFiles: index.files.length,
      totalBytes,
      recentFiles,
    };
  }

  async createFolder(input: {
    name: string;
    parentId: string | null;
  }): Promise<{ folder: VaultFolder; metadata: VaultMetadataIndex }> {
    const now = new Date().toISOString();
    const newFolder: VaultFolder = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      parentId: input.parentId,
      createdAt: now,
      updatedAt: now,
    };

    const metadata = await this.repo.mutate((current) => {
      if (
        newFolder.parentId !== null &&
        !current.folders.some((f) => f.id === newFolder.parentId)
      ) {
        throw new VaultAppError("FOLDER_NOT_FOUND", "Parent folder not found.", 404);
      }

      const duplicate = current.folders.some(
        (f) =>
          f.parentId === newFolder.parentId &&
          f.name.toLowerCase() === newFolder.name.toLowerCase()
      );
      if (duplicate) {
        throw new VaultAppError(
          "DUPLICATE_FOLDER_NAME",
          `Folder "${newFolder.name}" already exists here.`,
          409
        );
      }

      return {
        ...current,
        folders: [...current.folders, newFolder],
      };
    });

    return { folder: newFolder, metadata };
  }

  async renameFolder(
    folderId: string,
    input: { name: string }
  ): Promise<{ folder: VaultFolder; metadata: VaultMetadataIndex }> {
    return this.updateFolder(folderId, { name: input.name });
  }

  async updateFolder(
    folderId: string,
    input: { name?: string; isFavorite?: boolean }
  ): Promise<{ folder: VaultFolder; metadata: VaultMetadataIndex }> {
    const trimmedName = input.name !== undefined ? input.name.trim() : undefined;
    const now = new Date().toISOString();
    let updatedFolder: VaultFolder | null = null;

    const metadata = await this.repo.mutate((current) => {
      const target = current.folders.find((f) => f.id === folderId);
      if (!target) {
        throw new VaultAppError("FOLDER_NOT_FOUND", "Folder not found.", 404);
      }

      if (trimmedName !== undefined) {
        const duplicate = current.folders.some(
          (f) =>
            f.id !== folderId &&
            f.parentId === target.parentId &&
            f.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (duplicate) {
          throw new VaultAppError(
            "DUPLICATE_FOLDER_NAME",
            `Folder "${trimmedName}" already exists in this parent.`,
            409
          );
        }
      }

      updatedFolder = {
        ...target,
        name: trimmedName ?? target.name,
        isFavorite:
          input.isFavorite !== undefined ? input.isFavorite : target.isFavorite,
        updatedAt: now,
      };

      return {
        ...current,
        folders: current.folders.map((f) => (f.id === folderId ? updatedFolder! : f)),
      };
    });

    return { folder: updatedFolder!, metadata };
  }

  private collectFolderSubtree(
    index: VaultMetadataIndex,
    rootFolderId: string
  ): FolderTreeDeletePreview {
    const folder = index.folders.find((f) => f.id === rootFolderId);
    if (!folder) {
      throw new VaultAppError("FOLDER_NOT_FOUND", "Folder not found.", 404);
    }

    const childrenByParent = new Map<string, VaultFolder[]>();
    for (const f of index.folders) {
      if (f.parentId !== null) {
        const list = childrenByParent.get(f.parentId) ?? [];
        list.push(f);
        childrenByParent.set(f.parentId, list);
      }
    }

    const folderIds: string[] = [];
    const stack: string[] = [rootFolderId];
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      folderIds.push(currentId);
      const children = childrenByParent.get(currentId) ?? [];
      for (const child of children) {
        stack.push(child.id);
      }
    }

    const folderIdSet = new Set(folderIds);
    const files = index.files.filter(
      (file) => file.folderId !== null && folderIdSet.has(file.folderId)
    );

    return {
      folder,
      descendantFolderIds: folderIds,
      files,
      totalItemsToDelete: folderIds.length + files.length,
    };
  }

  async getFolderDeletePreview(folderId: string): Promise<FolderTreeDeletePreview> {
    const index = await this.getMetadata();
    return this.collectFolderSubtree(index, folderId);
  }

  async deleteFolder(folderId: string): Promise<{
    deletedFolderCount: number;
    deletedFileCount: number;
    metadata: VaultMetadataIndex;
  }> {
    const current = await this.getMetadata();
    const subtree = this.collectFolderSubtree(current, folderId);

    const objectKeys = subtree.files.map((f) => f.objectKey);
    if (objectKeys.length > 0) {
      await this.storage.deletePrivateObjects(objectKeys);
    }

    const removedFolderIds = new Set(subtree.descendantFolderIds);
    const removedFileIds = new Set(subtree.files.map((f) => f.id));

    const metadata = await this.repo.mutate(
      (latest) => ({
        ...latest,
        folders: latest.folders.filter((f) => !removedFolderIds.has(f.id)),
        files: latest.files.filter((f) => !removedFileIds.has(f.id)),
      }),
      { backupBeforeWrite: true }
    );

    return {
      deletedFolderCount: subtree.descendantFolderIds.length,
      deletedFileCount: subtree.files.length,
      metadata,
    };
  }

  async copyFolder(
    folderId: string,
    input: { targetParentId: string | null; newName?: string }
  ): Promise<{ folder: VaultFolder; metadata: VaultMetadataIndex }> {
    const current = await this.getMetadata();
    const subtree = this.collectFolderSubtree(current, folderId);

    if (input.targetParentId !== null) {
      const targetExists = current.folders.some((f) => f.id === input.targetParentId);
      if (!targetExists) {
        throw new VaultAppError(
          "FOLDER_NOT_FOUND",
          "Destination parent folder not found.",
          404
        );
      }

      if (subtree.descendantFolderIds.includes(input.targetParentId)) {
        throw new VaultAppError(
          "CIRCULAR_HIERARCHY",
          "Cannot copy a folder into itself or one of its subfolders.",
          400
        );
      }
    }

    const baseName = input.newName?.trim() || subtree.folder.name;
    const resolvedRootName = this.resolveCopyName(
      baseName,
      current.folders
        .filter((f) => f.parentId === input.targetParentId)
        .map((f) => f.name),
      Boolean(input.newName)
    );

    const folderMap = new Map(current.folders.map((f) => [f.id, f]));
    const idMap = new Map<string, string>();
    for (const oldId of subtree.descendantFolderIds) {
      idMap.set(oldId, crypto.randomUUID());
    }

    const now = new Date().toISOString();
    const newFolders: VaultFolder[] = subtree.descendantFolderIds.map((oldId) => {
      const orig = folderMap.get(oldId)!;
      const isRootCopy = oldId === folderId;
      return {
        id: idMap.get(oldId)!,
        name: isRootCopy ? resolvedRootName : orig.name,
        parentId: isRootCopy
          ? input.targetParentId
          : orig.parentId
            ? idMap.get(orig.parentId)!
            : null,
        createdAt: now,
        updatedAt: now,
      };
    });

    const createdObjectKeys: string[] = [];
    const newFiles: VaultFile[] = [];

    try {
      for (const origFile of subtree.files) {
        const newKey = generateObjectKey();
        await this.storage.copyPrivateObject(
          origFile.objectKey,
          newKey,
          origFile.mimeType
        );
        createdObjectKeys.push(newKey);
        newFiles.push({
          ...origFile,
          id: crypto.randomUUID(),
          folderId: origFile.folderId ? idMap.get(origFile.folderId)! : null,
          objectKey: newKey,
          createdAt: now,
          updatedAt: now,
        });
      }

      const metadata = await this.repo.mutate(
        (latest) => {
          if (
            input.targetParentId !== null &&
            !latest.folders.some((f) => f.id === input.targetParentId)
          ) {
            throw new VaultAppError(
              "FOLDER_NOT_FOUND",
              "Destination parent folder not found.",
              404
            );
          }
          const dup = latest.folders.some(
            (f) =>
              f.parentId === input.targetParentId &&
              f.name.toLowerCase() === resolvedRootName.toLowerCase()
          );
          if (dup) {
            throw new VaultAppError(
              "DUPLICATE_FOLDER_NAME",
              `Folder "${resolvedRootName}" already exists in destination.`,
              409
            );
          }

          return {
            ...latest,
            folders: [...latest.folders, ...newFolders],
            files: [...latest.files, ...newFiles],
          };
        },
        { backupBeforeWrite: true }
      );

      return { folder: newFolders[0], metadata };
    } catch (err) {
      if (createdObjectKeys.length > 0) {
        try {
          await this.storage.deletePrivateObjects(createdObjectKeys);
        } catch {
          // Best-effort cleanup of partially copied objects
        }
      }
      throw err;
    }
  }

  private resolveCopyName(
    desiredName: string,
    existingNames: string[],
    strictExplicitName: boolean
  ): string {
    const existingLower = new Set(existingNames.map((n) => n.toLowerCase()));
    if (!existingLower.has(desiredName.toLowerCase())) {
      return desiredName;
    }
    if (strictExplicitName) {
      throw new VaultAppError(
        "DUPLICATE_NAME",
        `"${desiredName}" already exists in the destination folder.`,
        409
      );
    }

    const dotIndex = desiredName.lastIndexOf(".");
    const hasExtension = dotIndex > 0 && dotIndex < desiredName.length - 1;
    const stem = hasExtension ? desiredName.slice(0, dotIndex) : desiredName;
    const ext = hasExtension ? desiredName.slice(dotIndex) : "";

    let attempt = `${stem} (copy)${ext}`;
    let counter = 2;
    while (existingLower.has(attempt.toLowerCase())) {
      attempt = `${stem} (copy ${counter})${ext}`;
      counter += 1;
    }
    return attempt;
  }

  async validateUploadTarget(input: {
    name: string;
    folderId: string | null;
    size: number;
  }): Promise<void> {
    const maxBytes = getMaxUploadSizeBytes();
    if (input.size > maxBytes) {
      throw new VaultAppError(
        "FILE_TOO_LARGE",
        `File size exceeds the maximum limit of ${Math.round(maxBytes / (1024 * 1024))} MB.`,
        413
      );
    }

    const index = await this.getMetadata();
    if (
      input.folderId !== null &&
      !index.folders.some((f) => f.id === input.folderId)
    ) {
      throw new VaultAppError("FOLDER_NOT_FOUND", "Target folder not found.", 404);
    }

    const duplicate = index.files.some(
      (f) =>
        f.folderId === input.folderId &&
        f.name.toLowerCase() === input.name.trim().toLowerCase()
    );
    if (duplicate) {
      throw new VaultAppError(
        "DUPLICATE_FILE_NAME",
        `A file named "${input.name.trim()}" already exists in this folder.`,
        409
      );
    }
  }

  async createNote(input: {
    name: string;
    folderId: string | null;
    content: string;
  }): Promise<{ file: VaultFile; metadata: VaultMetadataIndex }> {
    const trimmed = input.name.trim();
    const ext = extractExtension(trimmed);
    const normalizedName =
      ext === "md" || ext === "markdown" || ext === "txt" ? trimmed : `${trimmed}.md`;

    const bytes = Buffer.from(input.content, "utf8");
    await this.validateUploadTarget({
      name: normalizedName,
      folderId: input.folderId,
      size: bytes.byteLength,
    });

    const objectKey = generateObjectKey();
    const finalExt = extractExtension(normalizedName);
    const mimeType = finalExt === "txt" ? "text/plain" : "text/markdown";

    await this.storage.putPrivateObject(objectKey, bytes, mimeType, {
      allowOverwrite: false,
    });

    const now = new Date().toISOString();
    const newFile: VaultFile = {
      id: crypto.randomUUID(),
      name: normalizedName,
      folderId: input.folderId,
      objectKey,
      mimeType,
      extension: finalExt,
      size: bytes.byteLength,
      kind: "note",
      createdAt: now,
      updatedAt: now,
    };

    try {
      const metadata = await this.repo.mutate((latest) => {
        if (
          newFile.folderId !== null &&
          !latest.folders.some((f) => f.id === newFile.folderId)
        ) {
          throw new VaultAppError("FOLDER_NOT_FOUND", "Target folder not found.", 404);
        }
        const dup = latest.files.some(
          (f) =>
            f.folderId === newFile.folderId &&
            f.name.toLowerCase() === newFile.name.toLowerCase()
        );
        if (dup) {
          throw new VaultAppError(
            "DUPLICATE_FILE_NAME",
            `A file named "${newFile.name}" already exists in this folder.`,
            409
          );
        }
        return {
          ...latest,
          files: [...latest.files, newFile],
        };
      });

      return { file: newFile, metadata };
    } catch (err) {
      try {
        await this.storage.deletePrivateObjects([objectKey]);
      } catch {
        // Best-effort cleanup
      }
      throw err;
    }
  }

  async uploadFileBuffer(input: {
    name: string;
    folderId: string | null;
    data: Uint8Array;
    mimeType?: string;
  }): Promise<{ file: VaultFile; metadata: VaultMetadataIndex }> {
    const cleanName = input.name.trim();
    await this.validateUploadTarget({
      name: cleanName,
      folderId: input.folderId,
      size: input.data.byteLength,
    });

    const objectKey = generateObjectKey();
    const mimeType = normalizeMimeType(cleanName, input.mimeType);
    const extension = extractExtension(cleanName);
    const kind = detectFileKind(cleanName, mimeType);

    await this.storage.putPrivateObject(objectKey, input.data, mimeType, {
      allowOverwrite: false,
    });

    const now = new Date().toISOString();
    const newFile: VaultFile = {
      id: crypto.randomUUID(),
      name: cleanName,
      folderId: input.folderId,
      objectKey,
      mimeType,
      extension,
      size: input.data.byteLength,
      kind,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const metadata = await this.repo.mutate((latest) => {
        if (
          newFile.folderId !== null &&
          !latest.folders.some((f) => f.id === newFile.folderId)
        ) {
          throw new VaultAppError("FOLDER_NOT_FOUND", "Target folder not found.", 404);
        }
        const dup = latest.files.some(
          (f) =>
            f.folderId === newFile.folderId &&
            f.name.toLowerCase() === newFile.name.toLowerCase()
        );
        if (dup) {
          throw new VaultAppError(
            "DUPLICATE_FILE_NAME",
            `A file named "${newFile.name}" already exists in this folder.`,
            409
          );
        }
        return {
          ...latest,
          files: [...latest.files, newFile],
        };
      });

      return { file: newFile, metadata };
    } catch (err) {
      try {
        await this.storage.deletePrivateObjects([objectKey]);
      } catch {
        // Best-effort cleanup
      }
      throw err;
    }
  }

  async registerUploadedObject(input: {
    name: string;
    folderId: string | null;
    objectKey: string;
    mimeType?: string;
  }): Promise<{ file: VaultFile; metadata: VaultMetadataIndex }> {
    const cleanName = input.name.trim();
    const headInfo = await this.storage.headPrivateObject(input.objectKey);

    const maxBytes = getMaxUploadSizeBytes();
    if (headInfo.size > maxBytes) {
      await this.storage.deletePrivateObjects([input.objectKey]).catch(() => {});
      throw new VaultAppError(
        "FILE_TOO_LARGE",
        `Uploaded file exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`,
        413
      );
    }

    const mimeType = normalizeMimeType(
      cleanName,
      input.mimeType || headInfo.contentType
    );
    const extension = extractExtension(cleanName);
    const kind = detectFileKind(cleanName, mimeType);
    const now = new Date().toISOString();

    const newFile: VaultFile = {
      id: crypto.randomUUID(),
      name: cleanName,
      folderId: input.folderId,
      objectKey: headInfo.pathname,
      mimeType,
      extension,
      size: headInfo.size,
      kind,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const metadata = await this.repo.mutate((latest) => {
        if (
          newFile.folderId !== null &&
          !latest.folders.some((f) => f.id === newFile.folderId)
        ) {
          throw new VaultAppError("FOLDER_NOT_FOUND", "Target folder not found.", 404);
        }
        const dup = latest.files.some(
          (f) =>
            f.folderId === newFile.folderId &&
            f.name.toLowerCase() === newFile.name.toLowerCase()
        );
        if (dup) {
          throw new VaultAppError(
            "DUPLICATE_FILE_NAME",
            `A file named "${newFile.name}" already exists in this folder.`,
            409
          );
        }
        return {
          ...latest,
          files: [...latest.files, newFile],
        };
      });

      return { file: newFile, metadata };
    } catch (err) {
      try {
        await this.storage.deletePrivateObjects([input.objectKey]);
      } catch {
        // Best-effort cleanup
      }
      throw err;
    }
  }

  async getFileById(fileId: string): Promise<VaultFile> {
    const index = await this.getMetadata();
    const file = index.files.find((f) => f.id === fileId);
    if (!file) {
      throw new VaultAppError("FILE_NOT_FOUND", "File not found.", 404);
    }
    return file;
  }

  async updateFile(
    fileId: string,
    input: { name?: string; content?: string; isFavorite?: boolean }
  ): Promise<{ file: VaultFile; metadata: VaultMetadataIndex }> {
    const current = await this.getMetadata();
    const existing = current.files.find((f) => f.id === fileId);
    if (!existing) {
      throw new VaultAppError("FILE_NOT_FOUND", "File not found.", 404);
    }

    const nextName = input.name !== undefined ? input.name.trim() : existing.name;
    const nextExtension = extractExtension(nextName);
    const nextMime = normalizeMimeType(nextName, existing.mimeType);
    const nextKind =
      input.name !== undefined ? detectFileKind(nextName, nextMime) : existing.kind;
    let nextSize = existing.size;

    if (input.content !== undefined) {
      if (
        existing.kind !== "note" &&
        existing.kind !== "text" &&
        existing.kind !== "code"
      ) {
        throw new VaultAppError(
          "UNSUPPORTED_EDIT",
          "Only note and text/code files can be edited inline.",
          400
        );
      }
      const bytes = Buffer.from(input.content, "utf8");
      await this.storage.putPrivateObject(existing.objectKey, bytes, nextMime, {
        allowOverwrite: true,
      });
      nextSize = bytes.byteLength;
    }

    const now = new Date().toISOString();
    let updatedFile: VaultFile | null = null;

    const metadata = await this.repo.mutate((latest) => {
      const target = latest.files.find((f) => f.id === fileId);
      if (!target) {
        throw new VaultAppError("FILE_NOT_FOUND", "File not found.", 404);
      }

      const duplicate = latest.files.some(
        (f) =>
          f.id !== fileId &&
          f.folderId === target.folderId &&
          f.name.toLowerCase() === nextName.toLowerCase()
      );
      if (duplicate) {
        throw new VaultAppError(
          "DUPLICATE_FILE_NAME",
          `A file named "${nextName}" already exists in this folder.`,
          409
        );
      }

      updatedFile = {
        ...target,
        name: nextName,
        extension: nextExtension,
        mimeType: nextMime,
        kind: nextKind,
        size: nextSize,
        isFavorite:
          input.isFavorite !== undefined ? input.isFavorite : target.isFavorite,
        updatedAt: now,
      };

      return {
        ...latest,
        files: latest.files.map((f) => (f.id === fileId ? updatedFile! : f)),
      };
    });

    return { file: updatedFile!, metadata };
  }

  async copyFile(
    fileId: string,
    input: { targetFolderId: string | null; newName?: string }
  ): Promise<{ file: VaultFile; metadata: VaultMetadataIndex }> {
    const current = await this.getMetadata();
    const source = current.files.find((f) => f.id === fileId);
    if (!source) {
      throw new VaultAppError("FILE_NOT_FOUND", "Source file not found.", 404);
    }

    if (
      input.targetFolderId !== null &&
      !current.folders.some((f) => f.id === input.targetFolderId)
    ) {
      throw new VaultAppError(
        "FOLDER_NOT_FOUND",
        "Destination folder not found.",
        404
      );
    }

    const desiredName = input.newName?.trim() || source.name;
    const resolvedName = this.resolveCopyName(
      desiredName,
      current.files
        .filter((f) => f.folderId === input.targetFolderId)
        .map((f) => f.name),
      Boolean(input.newName)
    );

    const newObjectKey = generateObjectKey();
    await this.storage.copyPrivateObject(
      source.objectKey,
      newObjectKey,
      source.mimeType
    );

    const now = new Date().toISOString();
    const copiedFile: VaultFile = {
      ...source,
      id: crypto.randomUUID(),
      name: resolvedName,
      folderId: input.targetFolderId,
      objectKey: newObjectKey,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const metadata = await this.repo.mutate(
        (latest) => {
          if (
            copiedFile.folderId !== null &&
            !latest.folders.some((f) => f.id === copiedFile.folderId)
          ) {
            throw new VaultAppError(
              "FOLDER_NOT_FOUND",
              "Destination folder not found.",
              404
            );
          }
          const dup = latest.files.some(
            (f) =>
              f.folderId === copiedFile.folderId &&
              f.name.toLowerCase() === copiedFile.name.toLowerCase()
          );
          if (dup) {
            throw new VaultAppError(
              "DUPLICATE_FILE_NAME",
              `A file named "${copiedFile.name}" already exists in destination.`,
              409
            );
          }
          return {
            ...latest,
            files: [...latest.files, copiedFile],
          };
        },
        { backupBeforeWrite: true }
      );

      return { file: copiedFile, metadata };
    } catch (err) {
      try {
        await this.storage.deletePrivateObjects([newObjectKey]);
      } catch {
        // Best-effort cleanup
      }
      throw err;
    }
  }

  async deleteFile(fileId: string): Promise<{
    deletedFile: VaultFile;
    metadata: VaultMetadataIndex;
  }> {
    const existing = await this.getFileById(fileId);
    await this.storage.deletePrivateObjects([existing.objectKey]);

    const metadata = await this.repo.mutate(
      (latest) => ({
        ...latest,
        files: latest.files.filter((f) => f.id !== fileId),
      }),
      { backupBeforeWrite: true }
    );

    return { deletedFile: existing, metadata };
  }
}
