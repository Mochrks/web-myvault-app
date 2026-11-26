"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  Files,
  Folder,
  FolderPlus,
  HardDrive,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  PlusCircle,
  Star,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useVaultLayout } from "@/components/layout/vault-header-context";
import { useVault } from "@/components/vault/vault-provider";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { formatBytes } from "@/lib/utils/format";

function extractFolderIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith("/files/")) return null;
  const rest = pathname.slice("/files/".length).split("/").filter(Boolean);
  return rest.length > 0 ? rest[rest.length - 1] : null;
}

const SOFT_STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024; // 1 GB visual indicator reference

function SidebarNavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  const linkEl = (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
        collapsed && "justify-center px-0 h-9 w-9 mx-auto",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate flex-1">{label}</span>}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{badge}</span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return linkEl;
}

export function VaultSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { sidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen } = useVaultLayout();

  const {
    metadata,
    openNewFolderDialog,
    openNewNoteDialog,
    openUploadDialog,
  } = useVault();

  const activeFolderId = extractFolderIdFromPath(pathname);
  const currentKindParam = searchParams.get("kind");
  const [loggingOut, setLoggingOut] = React.useState(false);

  const pinnedFolders = React.useMemo(
    () =>
      metadata.folders
        .filter((f) => f.isFavorite)
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 6),
    [metadata.folders]
  );

  const markdownCount = React.useMemo(
    () =>
      metadata.files.filter(
        (f) => f.extension === "md" || f.extension === "markdown"
      ).length,
    [metadata.files]
  );

  const notesCount = React.useMemo(
    () => metadata.files.filter((f) => f.extension === "txt").length,
    [metadata.files]
  );

  const favoritesCount = React.useMemo(
    () =>
      metadata.folders.filter((f) => f.isFavorite).length +
      metadata.files.filter((f) => f.isFavorite).length,
    [metadata.folders, metadata.files]
  );

  const totalBytes = React.useMemo(
    () => metadata.files.reduce((sum, f) => sum + f.size, 0),
    [metadata.files]
  );

  const storagePercent = Math.min(100, Math.round((totalBytes / SOFT_STORAGE_QUOTA_BYTES) * 100));

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

  const renderSidebarContent = (collapsed: boolean, onCloseMobile?: () => void) => {
    const closeAnd = (fn: () => void) => {
      onCloseMobile?.();
      fn();
    };

    const isMarkdownView = pathname === "/files" && currentKindParam === "markdown";
    const isNotesView = pathname === "/files" && currentKindParam === "note";
    const isFilesView =
      (pathname === "/files" &&
        currentKindParam !== "note" &&
        currentKindParam !== "markdown") ||
      pathname.startsWith("/files/");

    return (
      <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
        {/* Brand Header */}
        <div
          className={cn(
            "flex h-13 shrink-0 items-center justify-center px-3.5",
            collapsed && "px-0"
          )}
        >
          <Link
            href="/dashboard"
            onClick={onCloseMobile}
            className="transition-opacity hover:opacity-85"
          >
            {collapsed ? (
              <span className="text-base font-bold tracking-tight text-foreground">mv</span>
            ) : (
              <span className="text-xl font-bold tracking-tight text-foreground">myvault</span>
            )}
          </Link>
        </div>

        {/* Quick Create */}
        <div className={cn("px-3 pt-1 pb-3", collapsed && "px-2")}>
          {collapsed ? (
            <div className="flex flex-col items-center">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        className="h-9 w-9 rounded-lg"
                        aria-label="Quick create"
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="right">Quick Create</TooltipContent>
                </Tooltip>
                <DropdownMenuContent side="right" align="start" className="w-48">
                  <DropdownMenuLabel>Create or Upload</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => closeAnd(() => openUploadDialog(activeFolderId))}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload Files
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => closeAnd(() => openNewNoteDialog(activeFolderId, "md"))}
                  >
                    <NotebookPen className="h-3.5 w-3.5" />
                    New Markdown (.md)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => closeAnd(() => openNewNoteDialog(activeFolderId, "txt"))}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    New Note (.txt)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => closeAnd(() => openNewFolderDialog(activeFolderId))}
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    New Folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 w-full justify-start gap-2 rounded-lg px-3 font-medium"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Quick Create</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>Create in current folder</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => closeAnd(() => openUploadDialog(activeFolderId))}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Files
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => closeAnd(() => openNewNoteDialog(activeFolderId, "md"))}
                >
                  <NotebookPen className="h-3.5 w-3.5" />
                  New Markdown (.md)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => closeAnd(() => openNewNoteDialog(activeFolderId, "txt"))}
                >
                  <FileText className="h-3.5 w-3.5" />
                  New Note (.txt)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => closeAnd(() => openNewFolderDialog(activeFolderId))}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  New Folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 space-y-6">
          <nav aria-label="Workspace navigation" className="space-y-0.5">
            <SidebarNavItem
              href="/dashboard"
              label="Dashboard"
              icon={LayoutDashboard}
              active={pathname === "/dashboard"}
              collapsed={collapsed}
              onClick={onCloseMobile}
            />
            <SidebarNavItem
              href="/files"
              label="All Files"
              icon={Files}
              active={isFilesView}
              collapsed={collapsed}
              badge={metadata.files.length}
              onClick={onCloseMobile}
            />
            <SidebarNavItem
              href="/files?kind=markdown"
              label="Markdown"
              icon={NotebookPen}
              active={isMarkdownView}
              collapsed={collapsed}
              badge={markdownCount}
              onClick={onCloseMobile}
            />
            <SidebarNavItem
              href="/files?kind=note"
              label="Notes"
              icon={FileText}
              active={isNotesView}
              collapsed={collapsed}
              badge={notesCount}
              onClick={onCloseMobile}
            />
            <SidebarNavItem
              href="/favorites"
              label="Favorites"
              icon={Star}
              active={pathname === "/favorites"}
              collapsed={collapsed}
              badge={favoritesCount}
              onClick={onCloseMobile}
            />
          </nav>

          {/* Pinned Folders (Flat list only — deep tree lives in Content Pane) */}
          {!collapsed && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-2.5">
                <span className="text-[11px] font-medium tracking-wider text-muted-foreground/80">
                  Pinned Folders
                </span>
              </div>

              {pinnedFolders.length === 0 ? (
                <p className="px-2.5 py-1 text-xs text-muted-foreground/70">
                  Star folders to pin them here.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {pinnedFolders.map((folder) => {
                    const isActive = activeFolderId === folder.id;
                    return (
                      <Link
                        key={folder.id}
                        href={`/files/${folder.id}`}
                        onClick={onCloseMobile}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                        )}
                      >
                        <Folder className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                        <span className="truncate">{folder.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: Storage & Lock */}
        <div className={cn("p-3 space-y-2 border-t border-sidebar-border", collapsed && "px-2")}>
          {!collapsed && (
            <div className="rounded-xl border border-border bg-card/80 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                  <HardDrive className="h-3.5 w-3.5" />
                  Storage
                </span>
                <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                  {formatBytes(totalBytes)}
                </span>
              </div>
              <Progress value={Math.max(storagePercent, totalBytes > 0 ? 3 : 0)} />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{metadata.folders.length} folders</span>
                <span>{metadata.files.length} files</span>
              </div>
            </div>
          )}

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mx-auto flex h-9 w-9 text-muted-foreground hover:text-foreground"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  aria-label="Lock and sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Lock &amp; Sign Out</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              {loggingOut ? "Locking vault..." : "Lock & Sign Out"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <aside
        className={cn(
          "hidden shrink-0 transition-[width] duration-200 ease-out lg:block",
          sidebarCollapsed ? "w-[60px]" : "w-[236px]"
        )}
      >
        {renderSidebarContent(sidebarCollapsed)}
      </aside>

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0">
          <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
          {renderSidebarContent(false, () => setMobileSidebarOpen(false))}
        </SheetContent>
      </Sheet>
    </>
  );
}
