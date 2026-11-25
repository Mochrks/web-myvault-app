"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  NotebookPen,
  Search,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VaultEntryIcon } from "@/components/vault/file-icon";
import { useVault } from "@/components/vault/vault-provider";
import { formatBytes, formatRelativeDate } from "@/lib/utils/format";

export function DashboardClient() {
  const router = useRouter();
  const {
    metadata,
    getFolderPathLabel,
    setActiveSearchOpen,
    openNewFolderDialog,
    openNewNoteDialog,
    openUploadDialog,
    setPreviewFile,
  } = useVault();

  const totalBytes = React.useMemo(
    () => metadata.files.reduce((sum, f) => sum + f.size, 0),
    [metadata.files]
  );

  const recentFiles = React.useMemo(
    () =>
      [...metadata.files]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 8),
    [metadata.files]
  );

  const openFile = (fileId: string) => {
    const file = metadata.files.find((f) => f.id === fileId);
    if (!file) return;
    if (
      file.extension === "md" ||
      file.extension === "markdown" ||
      file.extension === "txt"
    ) {
      router.push(`/notes/${file.id}`);
    } else {
      setPreviewFile(file);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Personal Vault
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Private, encrypted-at-rest storage for your notes, code, and files.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openNewFolderDialog(null)}
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openNewNoteDialog(null)}
          >
            <NotebookPen className="h-4 w-4" />
            New Note
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => openUploadDialog(null)}
          >
            <Upload className="h-4 w-4" />
            Upload Files
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Total Folders</span>
            <Folder className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {metadata.folders.length}
          </div>
          <Link
            href="/files"
            className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Browse directories
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card/50 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Total Files</span>
            <FileText className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {metadata.files.length}
          </div>
          <button
            type="button"
            onClick={() => setActiveSearchOpen(true)}
            className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Search className="h-3 w-3" />
            Quick search (Ctrl+K)
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card/50 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Storage Used</span>
            <HardDrive className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono text-foreground">
            {formatBytes(totalBytes)}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Private Vercel Blob storage
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Files
          </h2>
          <Link
            href="/files"
            className="text-xs text-primary hover:underline"
          >
            View all files
          </Link>
        </div>

        {recentFiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/30 px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              Your vault is empty
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create your first note or upload a file to get started.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60 rounded-xl border border-border bg-card/40">
            {recentFiles.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => openFile(file.id)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/30"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <VaultEntryIcon type="file" kind={file.kind} className="h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {file.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {getFolderPathLabel(file.folderId)}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="hidden sm:inline-flex font-mono text-[11px]">
                    {file.extension ? `.${file.extension}` : file.kind}
                  </Badge>
                  <span className="hidden font-mono md:inline">
                    {formatBytes(file.size)}
                  </span>
                  <span>{formatRelativeDate(file.updatedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
