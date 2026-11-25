"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api/client";
import type { VaultFile, VaultFolder, VaultMetadataIndex } from "@/types/vault";

interface VaultContextValue {
  metadata: VaultMetadataIndex;
  maxUploadSizeMb: number;
  storageConfigured: boolean;
  storageError: string | null;
  isRefreshing: boolean;
  setMetadata: React.Dispatch<React.SetStateAction<VaultMetadataIndex>>;
  refreshMetadata: () => Promise<void>;
  getBreadcrumb: (folderId: string | null) => VaultFolder[];
  getFolderPathLabel: (folderId: string | null) => string;
  activeSearchOpen: boolean;
  setActiveSearchOpen: (open: boolean) => void;
  newFolderParentId: string | null | undefined;
  openNewFolderDialog: (parentId: string | null) => void;
  closeNewFolderDialog: () => void;
  newNoteFolderId: string | null | undefined;
  openNewNoteDialog: (folderId: string | null) => void;
  closeNewNoteDialog: () => void;
  uploadTargetFolderId: string | null | undefined;
  openUploadDialog: (folderId: string | null) => void;
  closeUploadDialog: () => void;
  previewFile: VaultFile | null;
  setPreviewFile: (file: VaultFile | null) => void;
}

const VaultContext = React.createContext<VaultContextValue | null>(null);

export function VaultProvider({
  initialMetadata,
  maxUploadSizeMb,
  storageConfigured = true,
  initialStorageError = null,
  children,
}: {
  initialMetadata: VaultMetadataIndex;
  maxUploadSizeMb: number;
  storageConfigured?: boolean;
  initialStorageError?: string | null;
  children: React.ReactNode;
}) {
  const [metadata, setMetadata] = React.useState<VaultMetadataIndex>(initialMetadata);
  const [storageError, setStorageError] = React.useState<string | null>(
    initialStorageError
  );
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [activeSearchOpen, setActiveSearchOpen] = React.useState(false);
  const [newFolderParentId, setNewFolderParentId] = React.useState<
    string | null | undefined
  >(undefined);
  const [newNoteFolderId, setNewNoteFolderId] = React.useState<
    string | null | undefined
  >(undefined);
  const [uploadTargetFolderId, setUploadTargetFolderId] = React.useState<
    string | null | undefined
  >(undefined);
  const [previewFile, setPreviewFile] = React.useState<VaultFile | null>(null);

  const refreshMetadata = React.useCallback(async () => {
    if (!storageConfigured) return;
    setIsRefreshing(true);
    try {
      const res = await apiRequest<{ metadata: VaultMetadataIndex }>(
        "/api/vault/metadata"
      );
      setMetadata(res.metadata);
      setStorageError(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to refresh vault metadata.";
      setStorageError(msg);
      toast.error(msg);
    } finally {
      setIsRefreshing(false);
    }
  }, [storageConfigured]);

  const folderMap = React.useMemo(
    () => new Map(metadata.folders.map((f) => [f.id, f])),
    [metadata.folders]
  );

  const getBreadcrumb = React.useCallback(
    (folderId: string | null): VaultFolder[] => {
      const chain: VaultFolder[] = [];
      const visited = new Set<string>();
      let cursor = folderId;
      while (cursor && !visited.has(cursor)) {
        visited.add(cursor);
        const folder = folderMap.get(cursor);
        if (!folder) break;
        chain.unshift(folder);
        cursor = folder.parentId;
      }
      return chain;
    },
    [folderMap]
  );

  const getFolderPathLabel = React.useCallback(
    (folderId: string | null): string => {
      if (!folderId) return "Root";
      const chain = getBreadcrumb(folderId);
      return chain.length > 0 ? chain.map((f) => f.name).join(" / ") : "Root";
    },
    [getBreadcrumb]
  );

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setActiveSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value: VaultContextValue = {
    metadata,
    maxUploadSizeMb,
    storageConfigured,
    storageError,
    isRefreshing,
    setMetadata,
    refreshMetadata,
    getBreadcrumb,
    getFolderPathLabel,
    activeSearchOpen,
    setActiveSearchOpen,
    newFolderParentId,
    openNewFolderDialog: (parentId) => setNewFolderParentId(parentId),
    closeNewFolderDialog: () => setNewFolderParentId(undefined),
    newNoteFolderId,
    openNewNoteDialog: (folderId) => setNewNoteFolderId(folderId),
    closeNewNoteDialog: () => setNewNoteFolderId(undefined),
    uploadTargetFolderId,
    openUploadDialog: (folderId) => setUploadTargetFolderId(folderId),
    closeUploadDialog: () => setUploadTargetFolderId(undefined),
    previewFile,
    setPreviewFile,
  };

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const ctx = React.useContext(VaultContext);
  if (!ctx) {
    throw new Error("useVault must be used within a VaultProvider.");
  }
  return ctx;
}
