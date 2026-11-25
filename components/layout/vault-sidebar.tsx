"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Files,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  LayoutDashboard,
  Lock,
  LogOut,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CopyItemDialog,
  DeleteConfirmDialog,
  RenameItemDialog,
  type ActionTarget,
} from "@/components/vault/file-action-dialogs";
import { useVault } from "@/components/vault/vault-provider";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { formatBytes } from "@/lib/utils/format";
import type { VaultFolder } from "@/types/vault";

function extractFolderIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith("/files/")) return null;
  const rest = pathname.slice("/files/".length).split("/").filter(Boolean);
  return rest.length > 0 ? rest[rest.length - 1] : null;
}

interface FolderTreeNodeProps {
  folder: VaultFolder;
  depth: number;
  childrenMap: Map<string | null, VaultFolder[]>;
  activeFolderId: string | null;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  onAction: (action: "rename" | "copy" | "delete", folder: VaultFolder) => void;
  onNavigate?: () => void;
}

function FolderTreeNode({
  folder,
  depth,
  childrenMap,
  activeFolderId,
  expandedIds,
  toggleExpanded,
  onAction,
  onNavigate,
}: FolderTreeNodeProps) {
  const { openNewFolderDialog, openNewNoteDialog } = useVault();
  const childFolders = childrenMap.get(folder.id) ?? [];
  const hasChildren = childFolders.length > 0;
  const isExpanded = expandedIds.has(folder.id);
  const isActive = activeFolderId === folder.id;

  return (
    <div className="select-none">
      <div
        className={cn(
          "group flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
          isActive
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )}
      >
        <button
          type="button"
          onClick={() => hasChildren && toggleExpanded(folder.id)}
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded transition-transform text-muted-foreground/80 hover:text-foreground",
            !hasChildren && "invisible",
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
          className="flex min-w-0 flex-1 items-center gap-2 py-0.5"
        >
          {isActive || isExpanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-foreground/80" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{folder.name}</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 data-[state=open]:opacity-100 text-muted-foreground hover:text-foreground"
              aria-label={`Folder actions for ${folder.name}`}
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => openNewFolderDialog(folder.id)}>
              <FolderPlus className="h-4 w-4" />
              New Subfolder
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openNewNoteDialog(folder.id)}>
              <NotebookPen className="h-4 w-4" />
              New Note Here
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onAction("rename", folder)}>
              <Pencil className="h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction("copy", folder)}>
              <Copy className="h-4 w-4" />
              Copy to...
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onSelect={() => onAction("delete", folder)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-3 pl-2 border-l border-border/50 space-y-0.5 mt-0.5">
          {childFolders.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              childrenMap={childrenMap}
              activeFolderId={activeFolderId}
              expandedIds={expandedIds}
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

export function VaultSidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    metadata,
    getBreadcrumb,
    setActiveSearchOpen,
    openNewFolderDialog,
    openNewNoteDialog,
    openUploadDialog,
  } = useVault();

  const activeFolderId = extractFolderIdFromPath(pathname);

  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<ActionTarget | null>(
    null,
  );
  const [copyTarget, setCopyTarget] = React.useState<ActionTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ActionTarget | null>(
    null,
  );

  const autoExpandedIds = React.useMemo(() => {
    if (!activeFolderId) return new Set<string>();
    return new Set(getBreadcrumb(activeFolderId).map((f) => f.id));
  }, [activeFolderId, getBreadcrumb]);

  const effectiveExpandedIds = React.useMemo(() => {
    const merged = new Set(expandedIds);
    for (const id of autoExpandedIds) {
      merged.add(id);
    }
    return merged;
  }, [expandedIds, autoExpandedIds]);

  const childrenMap = React.useMemo(() => {
    const map = new Map<string | null, VaultFolder[]>();
    const sorted = [...metadata.folders].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const folder of sorted) {
      const list = map.get(folder.parentId) ?? [];
      list.push(folder);
      map.set(folder.parentId, list);
    }
    return map;
  }, [metadata.folders]);

  const rootFolders = childrenMap.get(null) ?? [];

  const totalBytes = React.useMemo(
    () => metadata.files.reduce((sum, f) => sum + f.size, 0),
    [metadata.files],
  );

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFolderAction = (
    action: "rename" | "copy" | "delete",
    folder: VaultFolder,
  ) => {
    const target: ActionTarget = { kind: "folder", item: folder };
    if (action === "rename") setRenameTarget(target);
    else if (action === "copy") setCopyTarget(target);
    else setDeleteTarget(target);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log out.");
      setLoggingOut(false);
    }
  };

  const sidebarBody = (
    <div className="flex h-full flex-col bg-card/60 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <Link
          href="/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-2 hover:opacity-85 transition-opacity"
        >
          <span className="text-sm font-semibold tracking-tight text-foreground">
            myvault
          </span>
          <span className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
            private
          </span>
        </Link>
        <button
          type="button"
          onClick={onCloseMobile}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        <div className="space-y-1">
          <Link
            href="/dashboard"
            onClick={onCloseMobile}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
              pathname === "/dashboard"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </Link>

          <Link
            href="/files"
            onClick={onCloseMobile}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
              pathname === "/files"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Files className="h-3.5 w-3.5" />
            All Files
          </Link>

          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              setActiveSearchOpen(true);
            }}
            className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <span className="flex items-center gap-2.5">
              <Search className="h-3.5 w-3.5" />
              Search
            </span>
            <kbd className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              Ctrl K
            </kbd>
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="px-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Quick Actions
          </div>
          <div className="grid grid-cols-3 gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-1.5 text-xs font-normal gap-1 hover:bg-accent"
              onClick={() => {
                onCloseMobile();
                openNewFolderDialog(activeFolderId);
              }}
            >
              <FolderPlus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>Folder</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-1.5 text-xs font-normal gap-1 hover:bg-accent"
              onClick={() => {
                onCloseMobile();
                openNewNoteDialog(activeFolderId);
              }}
            >
              <NotebookPen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>Note</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-1.5 text-xs font-normal gap-1 hover:bg-accent"
              onClick={() => {
                onCloseMobile();
                openUploadDialog(activeFolderId);
              }}
            >
              <Upload className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>Upload</span>
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Explorer
            </span>
            <button
              type="button"
              onClick={() => openNewFolderDialog(null)}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="New root folder"
              aria-label="New root folder"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          </div>

          {rootFolders.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              No folders created yet.
            </p>
          ) : (
            <div className="space-y-0.5">
              {rootFolders.map((folder) => (
                <FolderTreeNode
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  childrenMap={childrenMap}
                  activeFolderId={activeFolderId}
                  expandedIds={effectiveExpandedIds}
                  toggleExpanded={toggleExpanded}
                  onAction={handleFolderAction}
                  onNavigate={onCloseMobile}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border p-3 space-y-2">
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
              Storage
            </span>
            <span className="font-mono text-foreground font-medium">
              {formatBytes(totalBytes)}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {metadata.folders.length} folders &middot; {metadata.files.length}{" "}
            files
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-full justify-start text-xs text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          <LogOut className="h-3.5 w-3.5" />
          {loggingOut ? "Locking vault..." : "Lock & Sign Out"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-border lg:block">
        {sidebarBody}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] border-r border-border bg-background">
            {sidebarBody}
          </aside>
        </div>
      )}

      <RenameItemDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
      />
      <CopyItemDialog target={copyTarget} onClose={() => setCopyTarget(null)} />
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
    </>
  );
}
