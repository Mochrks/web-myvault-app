"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  NotebookPen,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VaultEntryIcon } from "@/components/vault/file-icon";
import { useVault } from "@/components/vault/vault-provider";
import { formatBytes, formatRelativeDate } from "@/lib/utils/format";

export function DashboardClient() {
  const router = useRouter();
  const {
    metadata,
    getFolderPathLabel,
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
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Overview of your personal vault and recent activity.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            Upload
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Total Folders
            </span>
            <Folder className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {metadata.folders.length}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Organized in directory hierarchy
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Total Files
            </span>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {metadata.files.length}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Notes, code, and documents
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Storage Used
            </span>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
            {formatBytes(totalBytes)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Private Vercel Blob storage
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Recent Files
            </h2>
            <p className="text-xs text-muted-foreground">
              Files and notes recently updated in your vault
            </p>
          </div>
          <Link
            href="/files"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
          >
            View all
          </Link>
        </div>

        {recentFiles.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              Your vault is empty
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create your first note or upload a file to get started.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentFiles.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => openFile(file.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-muted/40 cursor-pointer"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <VaultEntryIcon
                    type="file"
                    kind={file.kind}
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                  />
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
                  <span className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] sm:inline">
                    {file.extension ? `.${file.extension}` : file.kind}
                  </span>
                  <span className="hidden font-mono md:inline">
                    {formatBytes(file.size)}
                  </span>
                  <span suppressHydrationWarning>
                    {formatRelativeDate(file.updatedAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
