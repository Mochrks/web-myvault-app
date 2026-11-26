"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Download,
  FileCode2,
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  NotebookPen,
  Plus,
  RefreshCw,
  Search,
  Star,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VaultPageHeader } from "@/components/layout/vault-header-context";
import { VaultEntryIcon } from "@/components/vault/file-icon";
import { useVault } from "@/components/vault/vault-provider";
import { cn } from "@/lib/utils/cn";
import { formatBytes, formatRelativeDate } from "@/lib/utils/format";

export function DashboardClient() {
  const router = useRouter();
  const {
    metadata,
    isRefreshing,
    refreshMetadata,
    setActiveSearchOpen,
    getFolderPathLabel,
    openNewFolderDialog,
    openNewNoteDialog,
    openUploadDialog,
    setPreviewFile,
  } = useVault();

  const stats = React.useMemo(() => {
    const totalBytes = metadata.files.reduce((sum, f) => sum + f.size, 0);
    const markdownCount = metadata.files.filter(
      (f) => f.extension === "md" || f.extension === "markdown"
    ).length;
    const notesCount = metadata.files.filter((f) => f.extension === "txt").length;
    const codeCount = metadata.files.filter((f) => f.kind === "code").length;
    const pinnedFolders = metadata.folders.filter((f) => f.isFavorite).length;
    const starredFiles = metadata.files.filter((f) => f.isFavorite).length;

    const byKind = new Map<string, { count: number; bytes: number }>();
    for (const file of metadata.files) {
      const category =
        file.extension === "md" || file.extension === "markdown"
          ? "markdown"
          : file.extension === "txt"
            ? "notes"
            : file.kind;
      const prev = byKind.get(category) ?? { count: 0, bytes: 0 };
      byKind.set(category, {
        count: prev.count + 1,
        bytes: prev.bytes + file.size,
      });
    }

    const breakdown = Array.from(byKind.entries())
      .map(([kind, info]) => ({
        kind,
        count: info.count,
        bytes: info.bytes,
        pct: totalBytes > 0 ? Math.round((info.bytes / totalBytes) * 100) : 0,
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5);

    return {
      totalBytes,
      markdownCount,
      notesCount,
      codeCount,
      pinnedFolders,
      starredFiles,
      breakdown,
    };
  }, [metadata.files, metadata.folders]);

  const recentFiles = React.useMemo(
    () => [...metadata.files].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8),
    [metadata.files]
  );

  const openFile = (fileId: string) => {
    const file = metadata.files.find((f) => f.id === fileId);
    if (!file) return;
    if (file.extension === "md" || file.extension === "markdown" || file.extension === "txt") {
      router.push(`/notes/${file.id}`);
    } else {
      setPreviewFile(file);
    }
  };

  return (
    <>
      <VaultPageHeader
        left={<span className="truncate text-sm font-medium text-foreground">Dashboard</span>}
        right={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveSearchOpen(true)}
              className="hidden h-8 gap-2 text-muted-foreground sm:inline-flex"
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" className="h-8 gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  <span>New</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => openUploadDialog(null)}>
                  <Upload className="h-3.5 w-3.5" />
                  Upload Files
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openNewNoteDialog(null, "md")}>
                  <NotebookPen className="h-3.5 w-3.5" />
                  New Markdown (.md)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openNewNoteDialog(null, "txt")}>
                  <FileText className="h-3.5 w-3.5" />
                  New Note (.txt)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openNewFolderDialog(null)}>
                  <FolderPlus className="h-3.5 w-3.5" />
                  New Folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
        {/* 4 KPI Cards — Official shadcn/ui dashboard-01 neutral card aesthetic */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="vault-card-sheen">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardDescription>Total Files</CardDescription>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  <FileCode2 className="h-3 w-3" />
                  {stats.codeCount} code
                </Badge>
              </div>
              <div className="pt-1 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                {metadata.files.length}
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-xs font-medium text-foreground/90">Indexed in private vault</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Notes, source code, and documents
              </p>
            </CardContent>
          </Card>

          <Card className="vault-card-sheen">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardDescription>Folders</CardDescription>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  <Star className="h-3 w-3" />
                  {stats.pinnedFolders} pinned
                </Badge>
              </div>
              <div className="pt-1 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                {metadata.folders.length}
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-xs font-medium text-foreground/90">Nested directory hierarchy</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Explore via resizable tree in Files
              </p>
            </CardContent>
          </Card>

          <Card className="vault-card-sheen">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardDescription>Markdown &amp; Notes</CardDescription>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  <FileText className="h-3 w-3" />
                  {stats.notesCount} .txt
                </Badge>
              </div>
              <div className="pt-1 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                {stats.markdownCount + stats.notesCount}
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-xs font-medium text-foreground/90">
                {stats.markdownCount} Markdown · {stats.notesCount} Notes
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Rich .md editor &amp; plain .txt notes
              </p>
            </CardContent>
          </Card>

          <Card className="vault-card-sheen">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardDescription>Storage Used</CardDescription>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  <HardDrive className="h-3 w-3" />
                  Private
                </Badge>
              </div>
              <div className="pt-1 font-mono text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                {formatBytes(stats.totalBytes)}
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-xs font-medium text-foreground/90">Vercel Blob encrypted store</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stats.starredFiles} starred file
                {stats.starredFiles === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Storage Breakdown + Recent Activity */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Recent Files Table (2 cols) */}
          <Card className="lg:col-span-2 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription className="mt-0.5">
                  Latest files and notes updated in your vault
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="xs">
                <Link href="/files" className="gap-1">
                  View all
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>

            {recentFiles.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-sm font-medium text-foreground">Your vault is empty</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create your first markdown note or upload files to get started.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openNewNoteDialog(null)}
                  >
                    <NotebookPen className="h-3.5 w-3.5" />
                    New Note
                  </Button>
                  <Button type="button" size="sm" onClick={() => openUploadDialog(null)}>
                    <Upload className="h-3.5 w-3.5" />
                    Upload Files
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {recentFiles.map((file) => (
                  <div
                    key={file.id}
                    className="group flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-secondary/40"
                  >
                    <button
                      type="button"
                      onClick={() => openFile(file.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                        <VaultEntryIcon type="file" kind={file.kind} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-foreground group-hover:underline underline-offset-4">
                          {file.name}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {getFolderPathLabel(file.folderId)}
                        </div>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      <Badge
                        variant="secondary"
                        className="hidden font-mono text-[10px] sm:inline-flex"
                      >
                        {file.extension ? `.${file.extension}` : file.kind}
                      </Badge>
                      <span className="hidden font-mono tabular-nums md:inline">
                        {formatBytes(file.size)}
                      </span>
                      <span suppressHydrationWarning className="text-[11px] tabular-nums">
                        {formatRelativeDate(file.updatedAt)}
                      </span>
                      <a
                        href={`/api/vault/files/${file.id}/download`}
                        className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                        title={`Download ${file.name}`}
                        aria-label={`Download ${file.name}`}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Storage Breakdown & Quick Shortcuts (1 col) */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Storage Breakdown</CardTitle>
                <CardDescription>Distribution by file category</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.breakdown.length === 0 ? (
                  <p className="py-4 text-xs text-muted-foreground">
                    Upload files to see storage breakdown.
                  </p>
                ) : (
                  stats.breakdown.map((item) => (
                    <div key={item.kind} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="capitalize text-foreground/90">
                          {item.kind} <span className="text-muted-foreground">({item.count})</span>
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {formatBytes(item.bytes)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-foreground/75 transition-all"
                          style={{ width: `${Math.max(item.pct, 4)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Quick Links</CardTitle>
                <CardDescription>Jump straight into your workspace</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-1.5">
                <Button asChild variant="outline" size="sm" className="justify-between">
                  <Link href="/files">
                    <span className="flex items-center gap-2">
                      <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                      Browse Folder Tree
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-between">
                  <Link href="/files?kind=markdown">
                    <span className="flex items-center gap-2">
                      <NotebookPen className="h-3.5 w-3.5 text-muted-foreground" />
                      All Markdown (.md)
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-between">
                  <Link href="/files?kind=note">
                    <span className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      All Notes (.txt)
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-between">
                  <Link href="/favorites">
                    <span className="flex items-center gap-2">
                      <Star className="h-3.5 w-3.5 text-muted-foreground" />
                      Starred &amp; Pinned
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
