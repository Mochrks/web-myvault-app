"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  FolderPlus,
  Home,
  Menu,
  NotebookPen,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVault } from "@/components/vault/vault-provider";
import { cn } from "@/lib/utils/cn";

function extractFolderId(pathname: string): string | null {
  if (!pathname.startsWith("/files/")) return null;
  const segments = pathname.slice("/files/".length).split("/").filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : null;
}

export function VaultTopbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const pathname = usePathname();
  const {
    isRefreshing,
    refreshMetadata,
    getBreadcrumb,
    setActiveSearchOpen,
    openNewFolderDialog,
    openNewNoteDialog,
    openUploadDialog,
  } = useVault();

  const isFilesRoute = pathname === "/files" || pathname.startsWith("/files/");
  const currentFolderId = extractFolderId(pathname);
  const breadcrumb = isFilesRoute ? getBreadcrumb(currentFolderId) : [];

  let pageLabel = "Dashboard";
  if (pathname.startsWith("/notes/")) pageLabel = "Note Editor";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenMobile}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {isFilesRoute ? (
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1 text-sm"
          >
            <Link
              href="/files"
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-1 transition-colors hover:bg-muted",
                !currentFolderId
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Home className="h-3.5 w-3.5" />
              <span>Root</span>
            </Link>
            {breadcrumb.map((folder, index) => {
              const isLast = index === breadcrumb.length - 1;
              return (
                <React.Fragment key={folder.id}>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <Link
                    href={`/files/${folder.id}`}
                    className={cn(
                      "max-w-[160px] truncate rounded px-1.5 py-1 transition-colors hover:bg-muted",
                      isLast
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {folder.name}
                  </Link>
                </React.Fragment>
              );
            })}
          </nav>
        ) : (
          <div className="text-sm font-medium text-foreground">{pageLabel}</div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setActiveSearchOpen(true)}
          className="hidden sm:inline-flex text-muted-foreground"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Search</span>
          <kbd className="ml-1 rounded border border-border bg-muted px-1 py-0.2 text-[10px] font-mono">
            Ctrl K
          </kbd>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => refreshMetadata()}
          disabled={isRefreshing}
          title="Refresh vault"
          aria-label="Refresh vault"
        >
          <RefreshCw
            className={cn("h-4 w-4", isRefreshing && "animate-spin")}
          />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => openNewFolderDialog(currentFolderId)}
          className="hidden md:inline-flex"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          Folder
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => openNewNoteDialog(currentFolderId)}
          className="hidden md:inline-flex"
        >
          <NotebookPen className="h-3.5 w-3.5" />
          Note
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={() => openUploadDialog(currentFolderId)}
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Upload</span>
        </Button>
      </div>
    </header>
  );
}
