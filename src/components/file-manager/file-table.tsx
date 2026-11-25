"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Download,
  Eye,
  FolderPlus,
  LayoutGrid,
  LayoutList,
  Loader2,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Search,
  Star,
  Trash2,
  Upload,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CopyItemDialog,
  DeleteConfirmDialog,
  RenameItemDialog,
  type ActionTarget,
} from "@/components/vault/file-action-dialogs";
import { VaultEntryIcon } from "@/components/vault/file-icon";
import { useVault } from "@/components/vault/vault-provider";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { formatBytes, formatRelativeDate } from "@/lib/utils/format";
import type { FileKind, VaultFile, VaultFolder, VaultMetadataIndex } from "@/types/vault";

type SortKey = "name" | "kind" | "size" | "updatedAt";
type FilterKind = "all" | "folder" | FileKind;
type ViewMode = "list" | "grid";

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

export function FileTable({
  folderId,
  favoritesOnly = false,
}: {
  folderId: string | null;
  favoritesOnly?: boolean;
}) {
  const router = useRouter();
  const {
    metadata,
    setMetadata,
    refreshMetadata,
    openNewFolderDialog,
    openNewNoteDialog,
    openUploadDialog,
    setPreviewFile,
  } = useVault();

  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [filterKind, setFilterKind] = React.useState<FilterKind>("all");
  const [filterQuery, setFilterQuery] = React.useState("");
  const [selectionState, setSelectionState] = React.useState<{
    folderId: string | null;
    keys: Set<string>;
  }>({ folderId, keys: new Set() });

  const selectedKeys = React.useMemo(
    () => (selectionState.folderId === folderId ? selectionState.keys : new Set<string>()),
    [selectionState, folderId]
  );

  const [renameTarget, setRenameTarget] = React.useState<ActionTarget | null>(null);
  const [copyTarget, setCopyTarget] = React.useState<ActionTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ActionTarget | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);

  const currentFolder = React.useMemo(() => {
    if (!folderId) return null;
    return metadata.folders.find((f) => f.id === folderId) ?? undefined;
  }, [folderId, metadata.folders]);

  const rows = React.useMemo<RowEntry[]>(() => {
    const childFolders = metadata.folders
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
      .filter((f) => (favoritesOnly ? Boolean(f.isFavorite) : f.folderId === folderId))
      .map<RowEntry>((file) => ({
        key: `file:${file.id}`,
        entryType: "file",
        id: file.id,
        name: file.name,
        kindLabel: file.extension ? `.${file.extension}` : file.kind,
        kindFilter: file.kind,
        size: file.size,
        updatedAt: file.updatedAt,
        isFavorite: Boolean(file.isFavorite),
        file,
      }));

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
      // Keep folders grouped above files when sorting by name
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
    filterKind,
    filterQuery,
    sortKey,
    sortDir,
  ]);

  if (folderId && currentFolder === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-lg font-semibold text-foreground">Folder not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This folder may have been deleted or moved.
        </p>
        <Button asChild className="mt-6">
          <Link href="/files">Return to Root</Link>
        </Button>
      </div>
    );
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "updatedAt" || key === "size" ? "desc" : "asc");
    }
  };

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selectedKeys.has(r.key));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectionState({ folderId, keys: new Set() });
    } else {
      setSelectionState({ folderId, keys: new Set(rows.map((r) => r.key)) });
    }
  };

  const toggleRow = (key: string) => {
    setSelectionState((prev) => {
      const base = prev.folderId === folderId ? prev.keys : new Set<string>();
      const next = new Set(base);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { folderId, keys: next };
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
        deletedCount++;
      }
      await refreshMetadata();
      setSelectionState({ folderId, keys: new Set() });
      setBulkDeleteOpen(false);
      toast.success(`Deleted ${deletedCount} item(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete some items.");
      await refreshMetadata();
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {currentFolder && (
            <Button type="button" variant="outline" size="sm" asChild className="shrink-0">
              <Link href={currentFolder.parentId ? `/files/${currentFolder.parentId}` : "/files"}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Link>
            </Button>
          )}
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {favoritesOnly ? "Favorites" : currentFolder ? currentFolder.name : "All Files"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {rows.length} {rows.length === 1 ? "item" : "items"}{" "}
              {favoritesOnly ? "starred" : "in this directory"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedKeys.size > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selectedKeys.size})
            </Button>
          )}
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
            Upload
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder={favoritesOnly ? "Filter favorites..." : "Filter current folder..."}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterKind} onValueChange={(v) => setFilterKind(v as FilterKind)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="folder">Folders</SelectItem>
              <SelectItem value="note">Notes</SelectItem>
              <SelectItem value="code">Code</SelectItem>
              <SelectItem value="image">Images</SelectItem>
              <SelectItem value="pdf">PDFs</SelectItem>
              <SelectItem value="spreadsheet">Spreadsheets</SelectItem>
              <SelectItem value="document">Documents</SelectItem>
              <SelectItem value="archive">Archives</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-md border border-border bg-card p-0.5">
            <Button
              type="button"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
              title="List view"
              aria-label="List view"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("grid")}
              title="Grid view"
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            {filterQuery || filterKind !== "all"
              ? "No matching items"
              : favoritesOnly
                ? "No favorite items yet"
                : "This folder is empty"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {filterQuery || filterKind !== "all"
              ? "Try clearing your filter or search query."
              : favoritesOnly
                ? "Star files or folders to access them quickly here."
                : "Create a subfolder, write a markdown note, or upload files."}
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {rows.map((row) => {
            const isSelected = selectedKeys.has(row.key);
            const isNote =
              row.file &&
              (row.file.extension === "md" ||
                row.file.extension === "markdown" ||
                row.file.extension === "txt");

            return (
              <div
                key={row.key}
                className={cn(
                  "group relative flex flex-col justify-between rounded-lg border border-border bg-card p-3.5 transition-colors hover:bg-muted/30",
                  isSelected && "ring-1 ring-ring bg-muted/40"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleRow(row.key)}
                    aria-label={`Select ${row.name}`}
                  />
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
                          size="icon"
                          className="h-7 w-7"
                          aria-label={`Actions for ${row.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {row.entryType === "folder" ? (
                          <DropdownMenuItem onSelect={() => router.push(`/files/${row.id}`)}>
                            <Eye className="h-4 w-4" />
                            Open Folder
                          </DropdownMenuItem>
                        ) : (
                          <>
                            {isNote && (
                              <DropdownMenuItem onSelect={() => router.push(`/notes/${row.id}`)}>
                                <NotebookPen className="h-4 w-4" />
                                Edit Note
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={() => row.file && setPreviewFile(row.file)}>
                              <Eye className="h-4 w-4" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`/api/vault/files/${row.id}/download`}>
                                <Download className="h-4 w-4" />
                                Download
                              </a>
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => handleToggleFavorite(row)}>
                          <Star
                            className={cn(
                              "h-4 w-4",
                              row.isFavorite && "fill-current text-foreground"
                            )}
                          />
                          {row.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            setRenameTarget(
                              row.entryType === "folder"
                                ? { kind: "folder", item: row.folder! }
                                : { kind: "file", item: row.file! }
                            )
                          }
                        >
                          <Pencil className="h-4 w-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            setCopyTarget(
                              row.entryType === "folder"
                                ? { kind: "folder", item: row.folder! }
                                : { kind: "file", item: row.file! }
                            )
                          }
                        >
                          <Copy className="h-4 w-4" />
                          Copy to...
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          destructive
                          onSelect={() =>
                            setDeleteTarget(
                              row.entryType === "folder"
                                ? { kind: "folder", item: row.folder! }
                                : { kind: "file", item: row.file! }
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenRow(row)}
                  className="mt-3 flex flex-col items-start gap-2 text-left"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/40">
                    <VaultEntryIcon
                      type={row.entryType}
                      kind={row.file?.kind}
                      className="h-5 w-5"
                    />
                  </div>
                  <div className="w-full min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {row.kindLabel}
                      </Badge>
                      {row.entryType === "file" && (
                        <span className="font-mono">{formatBytes(row.size)}</span>
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
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all items"
                    />
                  </th>
                  <th className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSort("name")}
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    >
                      Name
                      <SortIndicator column="name" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="hidden px-3 py-2.5 sm:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort("kind")}
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    >
                      Type
                      <SortIndicator column="kind" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="hidden px-3 py-2.5 md:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort("size")}
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    >
                      Size
                      <SortIndicator column="size" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="hidden px-3 py-2.5 lg:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort("updatedAt")}
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    >
                      Modified
                      <SortIndicator column="updatedAt" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="w-12 px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row) => {
                  const isSelected = selectedKeys.has(row.key);
                  const isNote =
                    row.file &&
                    (row.file.extension === "md" ||
                      row.file.extension === "markdown" ||
                      row.file.extension === "txt");

                  return (
                    <tr key={row.key} className="group transition-colors hover:bg-muted/30">
                      <td className="px-3 py-2.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(row.key)}
                          aria-label={`Select ${row.name}`}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => handleOpenRow(row)}
                          className="flex items-center gap-2.5 text-left font-medium text-foreground hover:text-primary"
                        >
                          <VaultEntryIcon
                            type={row.entryType}
                            kind={row.file?.kind}
                            className="h-4 w-4 shrink-0"
                          />
                          <span className="truncate max-w-[220px] sm:max-w-[340px]">
                            {row.name}
                          </span>
                        </button>
                      </td>
                      <td className="hidden px-3 py-2.5 sm:table-cell">
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {row.kindLabel}
                        </Badge>
                      </td>
                      <td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground md:table-cell">
                        {row.entryType === "folder" ? "—" : formatBytes(row.size)}
                      </td>
                      <td
                        suppressHydrationWarning
                        className="hidden px-3 py-2.5 text-xs text-muted-foreground lg:table-cell"
                      >
                        {formatRelativeDate(row.updatedAt)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex items-center justify-end gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleToggleFavorite(row)}
                            aria-label={
                              row.isFavorite
                                ? `Remove ${row.name} from favorites`
                                : `Add ${row.name} to favorites`
                            }
                          >
                            <Star
                              className={cn(
                                "h-4 w-4",
                                row.isFavorite && "fill-current text-foreground"
                              )}
                            />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label={`Actions for ${row.name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {row.entryType === "folder" ? (
                                <DropdownMenuItem onSelect={() => router.push(`/files/${row.id}`)}>
                                  <Eye className="h-4 w-4" />
                                  Open Folder
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  {isNote && (
                                    <DropdownMenuItem
                                      onSelect={() => router.push(`/notes/${row.id}`)}
                                    >
                                      <NotebookPen className="h-4 w-4" />
                                      Edit Note
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onSelect={() => row.file && setPreviewFile(row.file)}
                                  >
                                    <Eye className="h-4 w-4" />
                                    Preview
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <a href={`/api/vault/files/${row.id}/download`}>
                                      <Download className="h-4 w-4" />
                                      Download
                                    </a>
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => handleToggleFavorite(row)}>
                                <Star
                                  className={cn(
                                    "h-4 w-4",
                                    row.isFavorite && "fill-current text-foreground"
                                  )}
                                />
                                {row.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  setRenameTarget(
                                    row.entryType === "folder"
                                      ? { kind: "folder", item: row.folder! }
                                      : { kind: "file", item: row.file! }
                                  )
                                }
                              >
                                <Pencil className="h-4 w-4" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  setCopyTarget(
                                    row.entryType === "folder"
                                      ? { kind: "folder", item: row.folder! }
                                      : { kind: "file", item: row.file! }
                                  )
                                }
                              >
                                <Copy className="h-4 w-4" />
                                Copy to...
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                onSelect={() =>
                                  setDeleteTarget(
                                    row.entryType === "folder"
                                      ? { kind: "folder", item: row.folder! }
                                      : { kind: "file", item: row.file! }
                                  )
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RenameItemDialog target={renameTarget} onClose={() => setRenameTarget(null)} />
      <CopyItemDialog target={copyTarget} onClose={() => setCopyTarget(null)} />
      <DeleteConfirmDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedKeys.size} selected item(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected files and folders (including any nested items
              inside selected folders) from private storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleBulkDelete();
              }}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
