"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Download,
  Folder,
  FolderOpen,
  FolderPlus,
  Home,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CopyItemDialog,
  DeleteConfirmDialog,
  RenameItemDialog,
  type ActionTarget,
} from "@/components/vault/file-action-dialogs";
import { useVault } from "@/components/vault/vault-provider";
import { triggerBulkDownload } from "@/lib/api/bulk-download";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import type { VaultFolder } from "@/types/vault";

interface TreeNodeProps {
  folder: VaultFolder;
  childrenMap: Map<string | null, VaultFolder[]>;
  itemCountMap: Map<string, number>;
  activeFolderId: string | null;
  expandedIds: Set<string>;
  visibleIds: Set<string> | null;
  toggleExpanded: (id: string) => void;
  onAction: (
    action: "rename" | "copy" | "delete" | "favorite" | "download",
    folder: VaultFolder
  ) => void;
  onNavigate?: () => void;
}

function FolderTreeNode({
  folder,
  childrenMap,
  itemCountMap,
  activeFolderId,
  expandedIds,
  visibleIds,
  toggleExpanded,
  onAction,
  onNavigate,
}: TreeNodeProps) {
  const { openNewFolderDialog, openNewNoteDialog, openUploadDialog } = useVault();
  const allChildren = childrenMap.get(folder.id) ?? [];
  const childFolders = visibleIds
    ? allChildren.filter((c) => visibleIds.has(c.id))
    : allChildren;
  const hasChildren = childFolders.length > 0;
  const isExpanded = visibleIds ? true : expandedIds.has(folder.id);
  const isActive = activeFolderId === folder.id;
  const itemCount = itemCountMap.get(folder.id) ?? 0;

  const menuItems = (MenuItem: typeof DropdownMenuItem, MenuSep: typeof DropdownMenuSeparator) => (
    <>
      <MenuItem onSelect={() => openNewFolderDialog(folder.id)}>
        <FolderPlus className="h-3.5 w-3.5" />
        New Subfolder
      </MenuItem>
      <MenuItem onSelect={() => openNewNoteDialog(folder.id, "md")}>
        <NotebookPen className="h-3.5 w-3.5" />
        New Markdown Here
      </MenuItem>
      <MenuItem onSelect={() => openNewNoteDialog(folder.id, "txt")}>
        <NotebookPen className="h-3.5 w-3.5" />
        New Note Here
      </MenuItem>
      <MenuItem onSelect={() => openUploadDialog(folder.id)}>
        <Upload className="h-3.5 w-3.5" />
        Upload Here
      </MenuItem>
      <MenuSep />
      <MenuItem onSelect={() => onAction("download", folder)}>
        <Download className="h-3.5 w-3.5" />
        Download as ZIP
      </MenuItem>
      <MenuItem onSelect={() => onAction("favorite", folder)}>
        <Star
          className={cn("h-3.5 w-3.5", folder.isFavorite && "fill-current")}
        />
        {folder.isFavorite ? "Unpin Folder" : "Pin to Sidebar"}
      </MenuItem>
      <MenuItem onSelect={() => onAction("rename", folder)}>
        <Pencil className="h-3.5 w-3.5" />
        Rename
      </MenuItem>
      <MenuItem onSelect={() => onAction("copy", folder)}>
        <Copy className="h-3.5 w-3.5" />
        Copy to...
      </MenuItem>
      <MenuSep />
      <MenuItem destructive onSelect={() => onAction("delete", folder)}>
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </MenuItem>
    </>
  );

  return (
    <div className="select-none">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "group flex items-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors",
              isActive
                ? "bg-accent text-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/55 hover:text-foreground"
            )}
          >
            <button
              type="button"
              onClick={() => hasChildren && toggleExpanded(folder.id)}
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground/80 hover:text-foreground cursor-pointer",
                !hasChildren && "invisible"
              )}
              aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>

            <Link
              href={`/files/${folder.id}`}
              onClick={onNavigate}
              className="flex min-w-0 flex-1 items-center gap-2 py-0.5 pr-1"
              title={folder.name}
            >
              {isActive || isExpanded ? (
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-neutral-200" />
              ) : (
                <Folder className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
              )}
              <span className="whitespace-nowrap">{folder.name}</span>
              {folder.isFavorite && (
                <Star className="h-2.5 w-2.5 shrink-0 fill-current text-neutral-400" />
              )}
            </Link>

            {itemCount > 0 && (
              <span className="shrink-0 pr-0.5 font-mono text-[10px] tabular-nums text-muted-foreground/70 group-hover:hidden">
                {itemCount}
              </span>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground group-hover:flex data-[state=open]:flex cursor-pointer"
                  aria-label={`Folder actions for ${folder.name}`}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {menuItems(DropdownMenuItem, DropdownMenuSeparator)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-48">
          {menuItems(
            ContextMenuItem as unknown as typeof DropdownMenuItem,
            ContextMenuSeparator as unknown as typeof DropdownMenuSeparator
          )}
        </ContextMenuContent>
      </ContextMenu>

      {hasChildren && isExpanded && (
        <div className="ml-[13px] mt-0.5 space-y-0.5 border-l border-border/70 pl-2">
          {childFolders.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              childrenMap={childrenMap}
              itemCountMap={itemCountMap}
              activeFolderId={activeFolderId}
              expandedIds={expandedIds}
              visibleIds={visibleIds}
              toggleExpanded={toggleExpanded}
              onAction={onAction}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTreePanel({
  activeFolderId,
  onClose,
  onNavigate,
}: {
  activeFolderId: string | null;
  onClose?: () => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { metadata, setMetadata, getBreadcrumb, openNewFolderDialog } = useVault();

  const [filterQuery, setFilterQuery] = React.useState("");
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => new Set());
  const [renameTarget, setRenameTarget] = React.useState<ActionTarget | null>(null);
  const [copyTarget, setCopyTarget] = React.useState<ActionTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ActionTarget | null>(null);

  const autoExpandedIds = React.useMemo(() => {
    if (!activeFolderId) return new Set<string>();
    return new Set(getBreadcrumb(activeFolderId).map((f) => f.id));
  }, [activeFolderId, getBreadcrumb]);

  const effectiveExpandedIds = React.useMemo(() => {
    const merged = new Set(expandedIds);
    for (const id of autoExpandedIds) merged.add(id);
    return merged;
  }, [expandedIds, autoExpandedIds]);

  const { childrenMap, itemCountMap, folderMap } = React.useMemo(() => {
    const cMap = new Map<string | null, VaultFolder[]>();
    const fMap = new Map<string, VaultFolder>();
    const countMap = new Map<string, number>();

    const sorted = [...metadata.folders].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const folder of sorted) {
      fMap.set(folder.id, folder);
      const list = cMap.get(folder.parentId) ?? [];
      list.push(folder);
      cMap.set(folder.parentId, list);
      if (folder.parentId) {
        countMap.set(folder.parentId, (countMap.get(folder.parentId) ?? 0) + 1);
      }
    }
    for (const file of metadata.files) {
      if (file.folderId) {
        countMap.set(file.folderId, (countMap.get(file.folderId) ?? 0) + 1);
      }
    }
    return { childrenMap: cMap, itemCountMap: countMap, folderMap: fMap };
  }, [metadata.folders, metadata.files]);

  // Filter tree while preserving ancestor chain so nested matches remain navigable
  const visibleIds = React.useMemo<Set<string> | null>(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return null;
    const matched = new Set<string>();
    for (const folder of metadata.folders) {
      if (folder.name.toLowerCase().includes(q)) {
        let cursor: VaultFolder | undefined = folder;
        const guard = new Set<string>();
        while (cursor && !guard.has(cursor.id)) {
          guard.add(cursor.id);
          matched.add(cursor.id);
          cursor = cursor.parentId ? folderMap.get(cursor.parentId) : undefined;
        }
      }
    }
    return matched;
  }, [filterQuery, metadata.folders, folderMap]);

  const rootFolders = React.useMemo(() => {
    const roots = childrenMap.get(null) ?? [];
    return visibleIds ? roots.filter((f) => visibleIds.has(f.id)) : roots;
  }, [childrenMap, visibleIds]);

  const rootDirectCount = React.useMemo(() => {
    const folders = metadata.folders.filter((f) => f.parentId === null).length;
    const files = metadata.files.filter((f) => f.folderId === null).length;
    return folders + files;
  }, [metadata.folders, metadata.files]);

  const allExpanded =
    metadata.folders.length > 0 &&
    effectiveExpandedIds.size >=
      metadata.folders.filter((f) => (childrenMap.get(f.id)?.length ?? 0) > 0)
        .length;

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(metadata.folders.map((f) => f.id)));
    }
  };

  const handleFolderAction = async (
    action: "rename" | "copy" | "delete" | "favorite" | "download",
    folder: VaultFolder
  ) => {
    if (action === "download") {
      const toastId = toast.loading(`Preparing "${folder.name}.zip"...`);
      try {
        const res = await triggerBulkDownload({
          fileIds: [],
          folderIds: [folder.id],
          archiveName: folder.name,
        });
        toast.success(`Downloaded ${res.filename}`, { id: toastId });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to download folder.",
          { id: toastId }
        );
      }
      return;
    }

    if (action === "favorite") {
      try {
        const res = await apiRequest<{ metadata: typeof metadata }>(
          `/api/vault/folders/${folder.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ isFavorite: !folder.isFavorite }),
          }
        );
        setMetadata(res.metadata);
        toast.success(
          folder.isFavorite ? "Unpinned from sidebar" : "Pinned to sidebar"
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update folder."
        );
      }
      return;
    }

    const target: ActionTarget = { kind: "folder", item: folder };
    if (action === "rename") setRenameTarget(target);
    else if (action === "copy") setCopyTarget(target);
    else setDeleteTarget(target);
  };

  return (
    <div className="flex h-full flex-col bg-card/35">
      {/* Tree Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold tracking-tight text-foreground">
          Folders
        </span>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => openNewFolderDialog(null)}
                aria-label="New root folder"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New root folder</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleToggleAll}
                aria-label={allExpanded ? "Collapse all folders" : "Expand all folders"}
              >
                {allExpanded ? (
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {allExpanded ? "Collapse all" : "Expand all"}
            </TooltipContent>
          </Tooltip>

          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={onClose}
                  aria-label="Hide folder tree"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Hide tree (Ctrl+\)</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Inline Folder Filter */}
      <div className="border-b border-border/70 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter folders..."
            className="h-8 w-full rounded-lg border border-border bg-background pr-7 pl-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Clear folder filter"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Horizontally & Vertically Scrollable Tree Body */}
      <div className="flex-1 overflow-auto p-2">
        <div className="min-w-max space-y-0.5">
          {/* Root Directory Link */}
          <Link
            href="/files"
            onClick={onNavigate}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
              activeFolderId === null
                ? "bg-accent text-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/55 hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-2">
              <Home className="h-3.5 w-3.5 shrink-0" />
              <span>All Files</span>
            </span>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground/80">
              {rootDirectCount}
            </span>
          </Link>

          {rootFolders.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-xs text-muted-foreground">
              {filterQuery.trim()
                ? "No matching folders."
                : "No folders yet."}
            </p>
          ) : (
            <div className="pt-1 space-y-0.5">
              {rootFolders.map((folder) => (
                <FolderTreeNode
                  key={folder.id}
                  folder={folder}
                  childrenMap={childrenMap}
                  itemCountMap={itemCountMap}
                  activeFolderId={activeFolderId}
                  expandedIds={effectiveExpandedIds}
                  visibleIds={visibleIds}
                  toggleExpanded={toggleExpanded}
                  onAction={handleFolderAction}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <RenameItemDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
      />
      <CopyItemDialog
        target={copyTarget}
        onClose={() => setCopyTarget(null)}
      />
      <DeleteConfirmDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          if (
            deleteTarget?.kind === "folder" &&
            activeFolderId === deleteTarget.item.id
          ) {
            const parent = deleteTarget.item.parentId;
            router.push(parent ? `/files/${parent}` : "/files");
          }
        }}
      />
    </div>
  );
}
