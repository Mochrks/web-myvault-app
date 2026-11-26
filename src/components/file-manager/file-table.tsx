"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { upload as blobClientUpload } from "@vercel/blob/client";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileText,
  FolderPlus,
  FolderTree,
  Home,
  LayoutGrid,
  LayoutList,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BulkActionBar } from "@/components/file-manager/bulk-action-bar";
import { FolderTreePanel } from "@/components/file-manager/folder-tree-panel";
import { VaultPageHeader, useVaultLayout } from "@/components/layout/vault-header-context";
import {
  CopyItemDialog,
  DeleteConfirmDialog,
  RenameItemDialog,
  type ActionTarget,
} from "@/components/vault/file-action-dialogs";
import { VaultEntryIcon } from "@/components/vault/file-icon";
import { useVault } from "@/components/vault/vault-provider";
import { triggerBulkDownload } from "@/lib/api/bulk-download";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { formatBytes, formatRelativeDate } from "@/lib/utils/format";
import type { FileKind, VaultFile, VaultFolder, VaultMetadataIndex } from "@/types/vault";

type SortKey = "name" | "kind" | "size" | "updatedAt";
type FilterKind = "all" | "folder" | "markdown" | FileKind;
type ViewMode = "list" | "grid";

const VALID_KINDS = new Set<FilterKind>([
  "all",
  "folder",
  "markdown",
  "note",
  "code",
  "text",
  "image",
  "pdf",
  "spreadsheet",
  "document",
  "archive",
  "other",
]);

interface RowEntry {
  key: string;
  entryType: "folder" | "file";
  id: string;
  name: string;
  kindLabel: string;
  kindFilter: FilterKind;
  size: number;
  updatedAt: string;
  isFavorite: boolean;
  folder?: VaultFolder;
  file?: VaultFile;
}

function SortIndicator({
  column,
  sortKey,
  sortDir,
}: {
  column: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
}) {
  if (sortKey !== column) return null;
  return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function SmartBreadcrumb({
  breadcrumb,
  currentFolderId,
}: {
  breadcrumb: VaultFolder[];
  currentFolderId: string | null;
}) {
  const shouldCollapse = breadcrumb.length > 3;
  const hiddenMiddle = shouldCollapse ? breadcrumb.slice(0, -2) : [];
  const visibleTrail = shouldCollapse ? breadcrumb.slice(-2) : breadcrumb;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-xs sm:text-[13px]">
      <Link
        href="/files"
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-accent",
          !currentFolderId
            ? "font-medium text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Home className="h-3.5 w-3.5" />
        <span className={cn(currentFolderId && "hidden sm:inline")}>All Files</span>
      </Link>

      {shouldCollapse && (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-md px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
                aria-label="Show parent folders"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {hiddenMiddle.map((folder) => (
                <DropdownMenuItem key={folder.id} asChild>
                  <Link href={`/files/${folder.id}`}>{folder.name}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      {visibleTrail.map((folder, index) => {
        const isLast = index === visibleTrail.length - 1;
        return (
          <React.Fragment key={folder.id}>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <Link
              href={`/files/${folder.id}`}
              className={cn(
                "max-w-[96px] truncate rounded-md px-1.5 py-1 transition-colors hover:bg-accent sm:max-w-[200px]",
                isLast
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={folder.name}
            >
              {folder.name}
            </Link>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export function FileTable({
  folderId,
  favoritesOnly = false,
}: {
  folderId: string | null;
  favoritesOnly?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kindParam = searchParams.get("kind") as FilterKind | null;
  const initialKind: FilterKind = kindParam && VALID_KINDS.has(kindParam) ? kindParam : "all";

  const { treePanelOpen, toggleTreePanel, mobileTreeOpen, setMobileTreeOpen } = useVaultLayout();

  const {
    metadata,
    maxUploadSizeMb,
    isRefreshing,
    setMetadata,
    refreshMetadata,
    getBreadcrumb,
    setActiveSearchOpen,
    openNewFolderDialog,
    openNewNoteDialog,
    openUploadDialog,
    setPreviewFile,
  } = useVault();

  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [kindOverride, setKindOverride] = React.useState<{
    base: FilterKind;
    value: FilterKind;
  } | null>(null);
  const filterKind: FilterKind =
    kindOverride && kindOverride.base === initialKind ? kindOverride.value : initialKind;
  const setFilterKind = React.useCallback(
    (next: FilterKind) => {
      setKindOverride({ base: initialKind, value: next });
    },
    [initialKind]
  );
  const [filterQuery, setFilterQuery] = React.useState("");
  const [selectionState, setSelectionState] = React.useState<{
    scope: string;
    keys: Set<string>;
  }>({ scope: favoritesOnly ? "favorites" : (folderId ?? "root"), keys: new Set() });

  const lastClickedIndexRef = React.useRef<number | null>(null);
  const scopeKey = favoritesOnly ? "favorites" : (folderId ?? "root");

  const selectedKeys = React.useMemo(
    () => (selectionState.scope === scopeKey ? selectionState.keys : new Set<string>()),
    [selectionState, scopeKey]
  );

  const [renameTarget, setRenameTarget] = React.useState<ActionTarget | null>(null);
  const [copyTarget, setCopyTarget] = React.useState<ActionTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ActionTarget | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [bulkDownloading, setBulkDownloading] = React.useState(false);
  const [bulkStarring, setBulkStarring] = React.useState(false);
  const [dragOverCanvas, setDragOverCanvas] = React.useState(false);
  const dragDepthRef = React.useRef(0);

  const currentFolder = React.useMemo(() => {
    if (!folderId) return null;
    return metadata.folders.find((f) => f.id === folderId) ?? undefined;
  }, [folderId, metadata.folders]);

  const breadcrumb = React.useMemo(
    () => (favoritesOnly ? [] : getBreadcrumb(folderId)),
    [favoritesOnly, folderId, getBreadcrumb]
  );

  // If ?kind=markdown or ?kind=note is active at root, show matching files across the vault
  const showAllMarkdownAcrossVault =
    !favoritesOnly && folderId === null && kindParam === "markdown" && filterKind === "markdown";
  const showAllNotesAcrossVault =
    !favoritesOnly && folderId === null && kindParam === "note" && filterKind === "note";

  const rows = React.useMemo<RowEntry[]>(() => {
    const childFolders =
      showAllNotesAcrossVault || showAllMarkdownAcrossVault
        ? []
        : metadata.folders
            .filter((f) => (favoritesOnly ? Boolean(f.isFavorite) : f.parentId === folderId))
            .map<RowEntry>((folder) => ({
              key: `folder:${folder.id}`,
              entryType: "folder",
              id: folder.id,
              name: folder.name,
              kindLabel: "folder",
              kindFilter: "folder",
              size: -1,
              updatedAt: folder.updatedAt,
              isFavorite: Boolean(folder.isFavorite),
              folder,
            }));

    const childFiles = metadata.files
      .filter((f) => {
        if (favoritesOnly) return Boolean(f.isFavorite);
        if (showAllMarkdownAcrossVault) {
          return f.extension === "md" || f.extension === "markdown";
        }
        if (showAllNotesAcrossVault) {
          return f.extension === "txt";
        }
        return f.folderId === folderId;
      })
      .map<RowEntry>((file) => {
        const isMd = file.extension === "md" || file.extension === "markdown";
        const isTxt = file.extension === "txt";
        return {
          key: `file:${file.id}`,
          entryType: "file",
          id: file.id,
          name: file.name,
          kindLabel: file.extension ? `.${file.extension}` : file.kind,
          kindFilter: isMd ? "markdown" : isTxt ? "note" : file.kind,
          size: file.size,
          updatedAt: file.updatedAt,
          isFavorite: Boolean(file.isFavorite),
          file,
        };
      });

    const combined = [...childFolders, ...childFiles].filter((row) => {
      if (filterKind !== "all" && row.kindFilter !== filterKind) return false;
      if (
        filterQuery.trim() &&
        !row.name.toLowerCase().includes(filterQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    combined.sort((a, b) => {
      if (sortKey === "name" && a.entryType !== b.entryType) {
        return a.entryType === "folder" ? -1 : 1;
      }
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "kind") cmp = a.kindLabel.localeCompare(b.kindLabel);
      else if (sortKey === "size") cmp = a.size - b.size;
      else cmp = a.updatedAt.localeCompare(b.updatedAt);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return combined;
  }, [
    metadata.folders,
    metadata.files,
    folderId,
    favoritesOnly,
    showAllMarkdownAcrossVault,
    showAllNotesAcrossVault,
    filterKind,
    filterQuery,
    sortKey,
    sortDir,
  ]);

  const clearSelection = React.useCallback(() => {
    setSelectionState({ scope: scopeKey, keys: new Set() });
    lastClickedIndexRef.current = null;
  }, [scopeKey]);

  const selectAllVisible = React.useCallback(() => {
    setSelectionState({
      scope: scopeKey,
      keys: new Set(rows.map((r) => r.key)),
    });
  }, [scopeKey, rows]);

  // Keyboard shortcuts: Esc clears selection, Ctrl/Cmd+A selects all
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (inEditable) return;

      if (event.key === "Escape" && selectedKeys.size > 0) {
        event.preventDefault();
        clearSelection();
      } else if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "a" &&
        rows.length > 0
      ) {
        event.preventDefault();
        selectAllVisible();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedKeys.size, clearSelection, selectAllVisible, rows.length]);

  const selectedSplit = React.useMemo(() => {
    const fileIds: string[] = [];
    const folderIds: string[] = [];
    for (const key of selectedKeys) {
      const [type, id] = key.split(":");
      if (type === "folder" && id) folderIds.push(id);
      else if (type === "file" && id) fileIds.push(id);
    }
    return { fileIds, folderIds };
  }, [selectedKeys]);

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selectedKeys.has(r.key));
  const someVisibleSelected = !allVisibleSelected && rows.some((r) => selectedKeys.has(r.key));

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "updatedAt" || key === "size" ? "desc" : "asc");
    }
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) clearSelection();
    else selectAllVisible();
  };

  const toggleRow = (key: string, index: number, shiftKey = false) => {
    setSelectionState((prev) => {
      const base = prev.scope === scopeKey ? prev.keys : new Set<string>();
      const next = new Set(base);

      if (shiftKey && lastClickedIndexRef.current !== null) {
        const start = Math.min(lastClickedIndexRef.current, index);
        const end = Math.max(lastClickedIndexRef.current, index);
        for (let i = start; i <= end; i += 1) {
          if (rows[i]) next.add(rows[i].key);
        }
      } else if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      lastClickedIndexRef.current = index;
      return { scope: scopeKey, keys: next };
    });
  };

  const handleOpenRow = (row: RowEntry) => {
    if (row.entryType === "folder" && row.folder) {
      router.push(`/files/${row.folder.id}`);
      return;
    }
    if (row.file) {
      if (
        row.file.extension === "md" ||
        row.file.extension === "markdown" ||
        row.file.extension === "txt"
      ) {
        router.push(`/notes/${row.file.id}`);
      } else {
        setPreviewFile(row.file);
      }
    }
  };

  const handleToggleFavorite = async (row: RowEntry) => {
    try {
      const endpoint =
        row.entryType === "folder" ? `/api/vault/folders/${row.id}` : `/api/vault/files/${row.id}`;
      const res = await apiRequest<{ metadata: VaultMetadataIndex }>(endpoint, {
        method: "PATCH",
        body: JSON.stringify({ isFavorite: !row.isFavorite }),
      });
      setMetadata(res.metadata);
      toast.success(row.isFavorite ? "Removed from favorites" : "Added to favorites");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update favorite.");
    }
  };

  const handleDownloadFolder = async (folder: VaultFolder) => {
    const toastId = toast.loading(`Preparing "${folder.name}.zip"...`);
    try {
      const res = await triggerBulkDownload({
        fileIds: [],
        folderIds: [folder.id],
        archiveName: folder.name,
      });
      toast.success(`Downloaded ${res.filename}`, { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download folder.", {
        id: toastId,
      });
    }
  };

  const handleBulkDownload = async () => {
    const { fileIds, folderIds } = selectedSplit;
    if (fileIds.length === 0 && folderIds.length === 0) return;

    setBulkDownloading(true);
    const total = fileIds.length + folderIds.length;
    const isSingle = fileIds.length === 1 && folderIds.length === 0;
    const toastId = isSingle
      ? undefined
      : toast.loading(`Preparing ZIP archive (${total} items)...`);

    try {
      const archiveName =
        folderIds.length === 1 && fileIds.length === 0
          ? metadata.folders.find((f) => f.id === folderIds[0])?.name
          : currentFolder?.name || "myvault-export";

      const result = await triggerBulkDownload({
        fileIds,
        folderIds,
        archiveName,
      });
      if (toastId) {
        toast.success(`Downloaded ${result.filename}`, { id: toastId });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bulk download failed.";
      if (toastId) toast.error(msg, { id: toastId });
      else toast.error(msg);
    } finally {
      setBulkDownloading(false);
    }
  };

  const handleBulkStar = async () => {
    if (selectedKeys.size === 0) return;
    setBulkStarring(true);
    try {
      const selectedRows = rows.filter((r) => selectedKeys.has(r.key));
      const allStarred = selectedRows.every((r) => r.isFavorite);
      const nextFav = !allStarred;
      let latestMeta: VaultMetadataIndex | null = null;
      for (const row of selectedRows) {
        const endpoint =
          row.entryType === "folder"
            ? `/api/vault/folders/${row.id}`
            : `/api/vault/files/${row.id}`;
        const res = await apiRequest<{ metadata: VaultMetadataIndex }>(endpoint, {
          method: "PATCH",
          body: JSON.stringify({ isFavorite: nextFav }),
        });
        latestMeta = res.metadata;
      }
      if (latestMeta) setMetadata(latestMeta);
      toast.success(
        nextFav
          ? `Starred ${selectedRows.length} item(s)`
          : `Removed ${selectedRows.length} item(s) from favorites`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update favorites.");
    } finally {
      setBulkStarring(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedKeys.size === 0) return;
    setBulkDeleting(true);
    let deletedCount = 0;
    try {
      for (const key of selectedKeys) {
        const [type, id] = key.split(":");
        if (type === "folder") {
          await apiRequest(`/api/vault/folders/${id}`, { method: "DELETE" });
        } else {
          await apiRequest(`/api/vault/files/${id}`, { method: "DELETE" });
        }
        deletedCount += 1;
      }
      await refreshMetadata();
      clearSelection();
      setBulkDeleteOpen(false);
      toast.success(`Deleted ${deletedCount} item(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete some items.");
      await refreshMetadata();
    } finally {
      setBulkDeleting(false);
    }
  };

  // Direct drag-and-drop upload onto the workspace canvas
  const handleDirectDropUpload = async (fileList: FileList) => {
    if (favoritesOnly || fileList.length === 0) return;
    const files = Array.from(fileList);
    const maxBytes = maxUploadSizeMb * 1024 * 1024;
    const toastId = toast.loading(
      `Uploading ${files.length} file${files.length > 1 ? "s" : ""}...`
    );

    let uploaded = 0;
    let failed = 0;
    let latestMeta: VaultMetadataIndex | null = null;

    for (const file of files) {
      if (file.size > maxBytes) {
        failed += 1;
        continue;
      }
      try {
        if (file.size <= 4 * 1024 * 1024) {
          const formData = new FormData();
          formData.append("file", file);
          if (folderId) formData.append("folderId", folderId);
          const res = await fetch("/api/vault/upload", {
            method: "POST",
            body: formData,
          });
          const json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(json?.error?.message || "Upload failed");
          }
          latestMeta = json.data.metadata;
        } else {
          const year = new Date().getUTCFullYear();
          const objectKey = `myvault/objects/${year}/${crypto.randomUUID()}`;
          const uploadedBlob = await blobClientUpload(objectKey, file, {
            access: "private",
            handleUploadUrl: "/api/vault/upload/token",
            multipart: true,
            clientPayload: JSON.stringify({
              name: file.name,
              folderId,
              size: file.size,
              mimeType: file.type || "application/octet-stream",
            }),
          });
          const reg = await apiRequest<{ metadata: VaultMetadataIndex }>("/api/vault/files", {
            method: "POST",
            body: JSON.stringify({
              name: file.name,
              folderId,
              objectKey: uploadedBlob.pathname,
              mimeType: file.type || uploadedBlob.contentType,
            }),
          });
          latestMeta = reg.metadata;
        }
        uploaded += 1;
      } catch {
        failed += 1;
      }
    }

    if (latestMeta) setMetadata(latestMeta);
    if (uploaded > 0 && failed === 0) {
      toast.success(`Uploaded ${uploaded} file${uploaded > 1 ? "s" : ""}`, { id: toastId });
    } else if (uploaded > 0 && failed > 0) {
      toast.warning(`Uploaded ${uploaded}, failed ${failed} file(s)`, {
        id: toastId,
      });
    } else {
      toast.error("Failed to upload dropped file(s).", { id: toastId });
    }
  };

  if (folderId && currentFolder === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-lg font-semibold text-foreground">Folder not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This folder may have been deleted or moved.
        </p>
        <Button asChild className="mt-6" size="sm">
          <Link href="/files">Return to All Files</Link>
        </Button>
      </div>
    );
  }

  const renderRowMenuItems = (
    row: RowEntry,
    MenuItem: typeof DropdownMenuItem,
    MenuSep: typeof DropdownMenuSeparator
  ) => {
    const isMd = row.file && (row.file.extension === "md" || row.file.extension === "markdown");
    const isTxt = row.file && row.file.extension === "txt";

    return (
      <>
        {row.entryType === "folder" && row.folder ? (
          <>
            <MenuItem onSelect={() => router.push(`/files/${row.id}`)}>
              <Eye className="h-3.5 w-3.5" />
              Open Folder
            </MenuItem>
            <MenuItem onSelect={() => handleDownloadFolder(row.folder!)}>
              <Download className="h-3.5 w-3.5" />
              Download as ZIP
            </MenuItem>
          </>
        ) : (
          <>
            {(isMd || isTxt) && (
              <MenuItem onSelect={() => router.push(`/notes/${row.id}`)}>
                <NotebookPen className="h-3.5 w-3.5" />
                {isMd ? "Edit Markdown" : "Edit Note"}
              </MenuItem>
            )}
            <MenuItem onSelect={() => row.file && setPreviewFile(row.file)}>
              <Eye className="h-3.5 w-3.5" />
              Preview
            </MenuItem>
            <MenuItem
              onSelect={() => {
                const a = document.createElement("a");
                a.href = `/api/vault/files/${row.id}/download`;
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </MenuItem>
          </>
        )}
        <MenuSep />
        <MenuItem onSelect={() => handleToggleFavorite(row)}>
          <Star className={cn("h-3.5 w-3.5", row.isFavorite && "fill-current")} />
          {row.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
        </MenuItem>
        <MenuItem
          onSelect={() =>
            setRenameTarget(
              row.entryType === "folder"
                ? { kind: "folder", item: row.folder! }
                : { kind: "file", item: row.file! }
            )
          }
        >
          <Pencil className="h-3.5 w-3.5" />
          Rename
        </MenuItem>
        <MenuItem
          onSelect={() =>
            setCopyTarget(
              row.entryType === "folder"
                ? { kind: "folder", item: row.folder! }
                : { kind: "file", item: row.file! }
            )
          }
        >
          <Copy className="h-3.5 w-3.5" />
          Copy to...
        </MenuItem>
        <MenuSep />
        <MenuItem
          destructive
          onSelect={() =>
            setDeleteTarget(
              row.entryType === "folder"
                ? { kind: "folder", item: row.folder! }
                : { kind: "file", item: row.file! }
            )
          }
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </MenuItem>
      </>
    );
  };

  const explorerPane = (
    <div
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-y-auto"
      onDragEnter={(e) => {
        if (favoritesOnly || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        dragDepthRef.current += 1;
        setDragOverCanvas(true);
      }}
      onDragOver={(e) => {
        if (favoritesOnly || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
      }}
      onDragLeave={() => {
        if (favoritesOnly) return;
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setDragOverCanvas(false);
      }}
      onDrop={(e) => {
        if (favoritesOnly || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        dragDepthRef.current = 0;
        setDragOverCanvas(false);
        void handleDirectDropUpload(e.dataTransfer.files);
      }}
    >
      {/* Global Drag-and-Drop Upload Overlay */}
      {dragOverCanvas && (
        <div className="pointer-events-none absolute inset-3 z-30 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-foreground/50 bg-background/90 backdrop-blur-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card">
            <Upload className="h-5 w-5 text-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">Drop files to upload here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Target: {currentFolder ? currentFolder.name : "All Files (Root)"}
          </p>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 pb-24 sm:p-6 sm:pb-24">
        {/* Directory Heading + Filter Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {favoritesOnly
                ? "Favorites"
                : showAllMarkdownAcrossVault
                  ? "Markdown"
                  : showAllNotesAcrossVault
                    ? "Notes"
                    : currentFolder
                      ? currentFolder.name
                      : "All Files"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {rows.length} {rows.length === 1 ? "item" : "items"}
              {favoritesOnly
                ? " starred across vault"
                : showAllMarkdownAcrossVault
                  ? " markdown (.md) files across vault"
                  : showAllNotesAcrossVault
                    ? " note (.txt) files across vault"
                    : " in this folder"}
            </p>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-center gap-2 sm:flex sm:flex-wrap sm:items-center">
            <div className="relative col-span-2 sm:col-span-1 sm:w-56">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter items..."
                className="h-8 bg-card pl-8 pr-7 text-xs"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery("")}
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Clear filter"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <Select value={filterKind} onValueChange={(v) => setFilterKind(v as FilterKind)}>
              <SelectTrigger className="h-8 w-full bg-card text-xs sm:w-40">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="folder">Folders</SelectItem>
                <SelectItem value="markdown">Markdown (.md)</SelectItem>
                <SelectItem value="note">Notes (.txt)</SelectItem>
                <SelectItem value="code">Code</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="pdf">PDFs</SelectItem>
                <SelectItem value="spreadsheet">Spreadsheets</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
                <SelectItem value="archive">Archives</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <Button
                type="button"
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon-sm"
                className="h-7 w-7"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                title="List view"
              >
                <LayoutList className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon-sm"
                className="h-7 w-7"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                title="Grid view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/35 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">
              {filterQuery || filterKind !== "all"
                ? "No matching items"
                : favoritesOnly
                  ? "No favorite items yet"
                  : "This folder is empty"}
            </p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {filterQuery || filterKind !== "all"
                ? "Try clearing your search or type filter."
                : favoritesOnly
                  ? "Star files or folders to pin and access them quickly."
                  : "Drag and drop files directly here, create a subfolder, or start a rich markdown note."}
            </p>
            {!favoritesOnly && !filterQuery && filterKind === "all" && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openNewFolderDialog(folderId)}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  New Folder
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openNewNoteDialog(folderId)}
                >
                  <NotebookPen className="h-3.5 w-3.5" />
                  New Note
                </Button>
                <Button type="button" size="sm" onClick={() => openUploadDialog(folderId)}>
                  <Upload className="h-3.5 w-3.5" />
                  Upload Files
                </Button>
              </div>
            )}
          </div>
        ) : viewMode === "grid" ? (
          /* Grid View */
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
            {rows.map((row, idx) => {
              const isSelected = selectedKeys.has(row.key);
              return (
                <ContextMenu key={row.key}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn(
                        "group relative flex flex-col justify-between rounded-xl border border-border bg-card p-3.5 transition-colors hover:bg-secondary/45",
                        isSelected && "border-foreground/40 bg-secondary/60"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(row.key, idx, e.shiftKey);
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => {}}
                            aria-label={`Select ${row.name}`}
                          />
                        </div>

                        <div className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleToggleFavorite(row)}
                            aria-label={
                              row.isFavorite
                                ? `Remove ${row.name} from favorites`
                                : `Add ${row.name} to favorites`
                            }
                          >
                            <Star
                              className={cn(
                                "h-3.5 w-3.5",
                                row.isFavorite && "fill-current text-foreground"
                              )}
                            />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${row.name}`}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {renderRowMenuItems(row, DropdownMenuItem, DropdownMenuSeparator)}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenRow(row)}
                        className="mt-3 flex flex-col items-start gap-2.5 text-left cursor-pointer"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
                          <VaultEntryIcon
                            type={row.entryType}
                            kind={row.file?.kind}
                            className="h-5 w-5"
                          />
                        </div>
                        <div className="w-full min-w-0">
                          <p
                            className="truncate text-sm font-medium text-foreground"
                            title={row.name}
                          >
                            {row.name}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {row.kindLabel}
                            </Badge>
                            {row.entryType === "file" && (
                              <span className="font-mono tabular-nums">
                                {formatBytes(row.size)}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      <div
                        suppressHydrationWarning
                        className="mt-3 border-t border-border/60 pt-2 text-[11px] text-muted-foreground"
                      >
                        {formatRelativeDate(row.updatedAt)}
                      </div>
                    </div>
                  </ContextMenuTrigger>

                  <ContextMenuContent className="w-48">
                    {renderRowMenuItems(
                      row,
                      ContextMenuItem as unknown as typeof DropdownMenuItem,
                      ContextMenuSeparator as unknown as typeof DropdownMenuSeparator
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        ) : (
          /* List DataTable View */
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-secondary/45 text-xs text-muted-foreground">
                  <tr>
                    <th className="w-10 px-3.5 py-2.5">
                      <Checkbox
                        checked={
                          allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false
                        }
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all items"
                      />
                    </th>
                    <th className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSort("name")}
                        className="inline-flex items-center gap-1 font-medium hover:text-foreground cursor-pointer"
                      >
                        Name
                        <SortIndicator column="name" sortKey={sortKey} sortDir={sortDir} />
                      </button>
                    </th>
                    <th className="hidden px-3 py-2.5 sm:table-cell">
                      <button
                        type="button"
                        onClick={() => toggleSort("kind")}
                        className="inline-flex items-center gap-1 font-medium hover:text-foreground cursor-pointer"
                      >
                        Type
                        <SortIndicator column="kind" sortKey={sortKey} sortDir={sortDir} />
                      </button>
                    </th>
                    <th className="hidden px-3 py-2.5 md:table-cell">
                      <button
                        type="button"
                        onClick={() => toggleSort("size")}
                        className="inline-flex items-center gap-1 font-medium hover:text-foreground cursor-pointer"
                      >
                        Size
                        <SortIndicator column="size" sortKey={sortKey} sortDir={sortDir} />
                      </button>
                    </th>
                    <th className="hidden px-3 py-2.5 lg:table-cell">
                      <button
                        type="button"
                        onClick={() => toggleSort("updatedAt")}
                        className="inline-flex items-center gap-1 font-medium hover:text-foreground cursor-pointer"
                      >
                        Modified
                        <SortIndicator column="updatedAt" sortKey={sortKey} sortDir={sortDir} />
                      </button>
                    </th>
                    <th className="w-20 px-3.5 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {rows.map((row, idx) => {
                    const isSelected = selectedKeys.has(row.key);
                    return (
                      <ContextMenu key={row.key}>
                        <ContextMenuTrigger asChild>
                          <tr
                            className={cn(
                              "group transition-colors hover:bg-secondary/45",
                              isSelected && "bg-secondary/60"
                            )}
                          >
                            <td className="px-3.5 py-2.5">
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRow(row.key, idx, e.shiftKey);
                                }}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => {}}
                                  aria-label={`Select ${row.name}`}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => handleOpenRow(row)}
                                className="flex items-center gap-2.5 text-left text-[13px] font-medium text-foreground hover:underline underline-offset-4 cursor-pointer"
                              >
                                <VaultEntryIcon
                                  type={row.entryType}
                                  kind={row.file?.kind}
                                  className="h-4 w-4 shrink-0"
                                />
                                <span
                                  className="max-w-[200px] truncate sm:max-w-[340px]"
                                  title={row.name}
                                >
                                  {row.name}
                                </span>
                              </button>
                            </td>
                            <td className="hidden px-3 py-2.5 sm:table-cell">
                              <Badge variant="secondary" className="font-mono text-[10px]">
                                {row.kindLabel}
                              </Badge>
                            </td>
                            <td className="hidden px-3 py-2.5 font-mono text-xs tabular-nums text-muted-foreground md:table-cell">
                              {row.entryType === "folder" ? "—" : formatBytes(row.size)}
                            </td>
                            <td
                              suppressHydrationWarning
                              className="hidden px-3 py-2.5 text-xs text-muted-foreground lg:table-cell"
                            >
                              {formatRelativeDate(row.updatedAt)}
                            </td>
                            <td className="px-3.5 py-2.5 text-right">
                              <div className="inline-flex items-center justify-end gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleToggleFavorite(row)}
                                  aria-label={
                                    row.isFavorite
                                      ? `Remove ${row.name} from favorites`
                                      : `Add ${row.name} to favorites`
                                  }
                                >
                                  <Star
                                    className={cn(
                                      "h-3.5 w-3.5",
                                      row.isFavorite && "fill-current text-foreground"
                                    )}
                                  />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Actions for ${row.name}`}
                                    >
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    {renderRowMenuItems(
                                      row,
                                      DropdownMenuItem,
                                      DropdownMenuSeparator
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        </ContextMenuTrigger>

                        <ContextMenuContent className="w-48">
                          {renderRowMenuItems(
                            row,
                            ContextMenuItem as unknown as typeof DropdownMenuItem,
                            ContextMenuSeparator as unknown as typeof DropdownMenuSeparator
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Single Context-Aware Top Header (Zero Stacked Action Bars) */}
      <VaultPageHeader
        left={
          <div className="flex min-w-0 items-center gap-2">
            {!favoritesOnly && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={treePanelOpen ? "secondary" : "ghost"}
                      size="icon-sm"
                      onClick={toggleTreePanel}
                      className="hidden lg:inline-flex"
                      aria-label="Toggle folder tree panel"
                    >
                      <FolderTree className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {treePanelOpen ? "Hide folder tree" : "Show folder tree"} (Ctrl+\)
                  </TooltipContent>
                </Tooltip>

                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setMobileTreeOpen(true)}
                  className="lg:hidden"
                >
                  <FolderTree className="h-3.5 w-3.5" />
                  Folders
                </Button>
              </>
            )}

            {favoritesOnly ? (
              <span className="truncate text-sm font-medium text-foreground">Favorites</span>
            ) : (
              <SmartBreadcrumb breadcrumb={breadcrumb} currentFolderId={folderId} />
            )}
          </div>
        }
        right={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveSearchOpen(true)}
              className="hidden h-8 gap-2 text-muted-foreground md:inline-flex"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">Search</span>
              <kbd className="rounded border border-border bg-secondary px-1.5 py-0.2 font-mono text-[10px]">
                Ctrl K
              </kbd>
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => refreshMetadata()}
                  disabled={isRefreshing}
                  aria-label="Refresh vault"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Refresh vault</TooltipContent>
            </Tooltip>

            {!favoritesOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" className="h-8 gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    <span>New</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={() => openUploadDialog(folderId)}>
                    <Upload className="h-3.5 w-3.5" />
                    Upload Files
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openNewNoteDialog(folderId, "md")}>
                    <NotebookPen className="h-3.5 w-3.5" />
                    New Markdown (.md)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openNewNoteDialog(folderId, "txt")}>
                    <FileText className="h-3.5 w-3.5" />
                    New Note (.txt)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openNewFolderDialog(folderId)}>
                    <FolderPlus className="h-3.5 w-3.5" />
                    New Folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      {/* Content Area: Resizable Folder Tree + File Explorer */}
      {favoritesOnly ? (
        explorerPane
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Desktop Split View */}
          <div className="hidden min-h-0 flex-1 lg:flex">
            {treePanelOpen ? (
              <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel
                  id="vault-folder-tree"
                  defaultSize="23%"
                  minSize="16%"
                  maxSize="38%"
                >
                  <FolderTreePanel activeFolderId={folderId} onClose={toggleTreePanel} />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel id="vault-file-explorer" minSize="55%">
                  {explorerPane}
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : (
              explorerPane
            )}
          </div>

          {/* Mobile / Tablet Explorer + Tree Sheet */}
          <div className="flex min-h-0 flex-1 lg:hidden">
            {explorerPane}
            <Sheet open={mobileTreeOpen} onOpenChange={setMobileTreeOpen}>
              <SheetContent side="left" className="p-0">
                <SheetTitle className="sr-only">Folder Explorer</SheetTitle>
                <FolderTreePanel
                  activeFolderId={folderId}
                  onNavigate={() => setMobileTreeOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}

      {/* Floating Bulk Selection Bar (Download ZIP, Star, Delete) */}
      <BulkActionBar
        selectedCount={selectedKeys.size}
        isSingleFileOnly={
          selectedSplit.fileIds.length === 1 && selectedSplit.folderIds.length === 0
        }
        allSelected={allVisibleSelected}
        downloading={bulkDownloading}
        starring={bulkStarring}
        onSelectAll={selectAllVisible}
        onClear={clearSelection}
        onDownload={handleBulkDownload}
        onToggleFavorite={handleBulkStar}
        onDelete={() => setBulkDeleteOpen(true)}
      />

      <RenameItemDialog target={renameTarget} onClose={() => setRenameTarget(null)} />
      <CopyItemDialog target={copyTarget} onClose={() => setCopyTarget(null)} />
      <DeleteConfirmDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !bulkDeleting && setBulkDeleteOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedKeys.size} selected item
              {selectedKeys.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected files and folders (including nested subfolders)
              from your vault. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
