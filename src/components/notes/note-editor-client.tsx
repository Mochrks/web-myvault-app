"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Columns2,
  Copy,
  Download,
  Eye,
  Loader2,
  Pencil,
  Save,
  Trash2,
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
import { MarkdownRenderer } from "@/components/notes/markdown-renderer";
import {
  DeleteConfirmDialog,
  RenameItemDialog,
  type ActionTarget,
} from "@/components/vault/file-action-dialogs";
import { useVault } from "@/components/vault/vault-provider";
import { apiRequest } from "@/lib/api/client";
import { formatBytes, formatExactDate } from "@/lib/utils/format";
import type { VaultFile, VaultMetadataIndex } from "@/types/vault";

export function NoteEditorClient({
  fileId,
  initialFile,
  initialContent,
}: {
  fileId: string;
  initialFile: VaultFile;
  initialContent: string;
}) {
  const router = useRouter();
  const { metadata, setMetadata, getFolderPathLabel } = useVault();

  const currentFile =
    metadata.files.find((f) => f.id === fileId) ?? initialFile;

  const [content, setContent] = React.useState(initialContent);
  const [savedContent, setSavedContent] = React.useState(initialContent);
  const [saving, setSaving] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"edit" | "split" | "preview">(
    currentFile.extension === "txt" ? "edit" : "split"
  );
  const [copied, setCopied] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<ActionTarget | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = React.useState<ActionTarget | null>(
    null
  );
  const [pendingNavHref, setPendingNavHref] = React.useState<string | null>(
    null
  );

  const isDirty = content !== savedContent;
  const isMarkdown =
    currentFile.extension === "md" || currentFile.extension === "markdown";

  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const handleSave = React.useCallback(async () => {
    if (saving || !isDirty) return;
    setSaving(true);
    try {
      const res = await apiRequest<{
        file: VaultFile;
        metadata: VaultMetadataIndex;
      }>(`/api/vault/files/${fileId}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      });
      setMetadata(res.metadata);
      setSavedContent(content);
      toast.success("Note saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save note.");
    } finally {
      setSaving(false);
    }
  }, [content, fileId, isDirty, saving, setMetadata]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Note content copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Failed to copy note content");
    }
  };

  const backHref = currentFile.folderId
    ? `/files/${currentFile.folderId}`
    : "/files";

  const attemptNavigate = (href: string) => {
    if (isDirty) {
      setPendingNavHref(href);
    } else {
      router.push(href);
    }
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-8rem)] flex-col gap-4">
      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#232838] bg-[#11141c] px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => attemptNavigate(backHref)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold text-[#eef1f7]">
                {currentFile.name}
              </h1>
              <button
                type="button"
                onClick={() =>
                  setRenameTarget({ kind: "file", item: currentFile })
                }
                aria-label="Rename note"
                className="rounded p-1 text-[#6b7489] hover:bg-[#171b26] hover:text-[#eef1f7] cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <Badge variant={isDirty ? "warning" : "success"}>
                {isDirty ? "Unsaved" : "Saved"}
              </Badge>
            </div>
            <p className="text-[11px] text-[#6b7489]">
              {getFolderPathLabel(currentFile.folderId)} ·{" "}
              {formatBytes(currentFile.size)} · Updated{" "}
              {formatExactDate(currentFile.updatedAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isMarkdown && (
            <div className="inline-flex rounded-lg border border-[#232838] bg-[#0e1118] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("edit")}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  viewMode === "edit"
                    ? "bg-[#1b202e] text-[#eef1f7]"
                    : "text-[#98a2b3] hover:text-[#eef1f7]"
                }`}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`hidden md:inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  viewMode === "split"
                    ? "bg-[#1b202e] text-[#eef1f7]"
                    : "text-[#98a2b3] hover:text-[#eef1f7]"
                }`}
              >
                <Columns2 className="h-3 w-3" />
                Split
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  viewMode === "preview"
                    ? "bg-[#1b202e] text-[#eef1f7]"
                    : "text-[#98a2b3] hover:text-[#eef1f7]"
                }`}
              >
                <Eye className="h-3 w-3" />
                Preview
              </button>
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCopyContent}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </Button>

          <Button asChild variant="secondary" size="sm">
            <Link href={`/api/vault/files/${fileId}/download`} prefetch={false}>
              <Download className="h-3.5 w-3.5" />
              Download
            </Link>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget({ kind: "file", item: currentFile })}
            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Editor / Preview Area */}
      <div
        className={`grid flex-1 gap-4 ${
          isMarkdown && viewMode === "split"
            ? "grid-cols-1 lg:grid-cols-2"
            : "grid-cols-1"
        }`}
      >
        {(viewMode === "edit" || viewMode === "split" || !isMarkdown) && (
          <div className="flex flex-col overflow-hidden rounded-xl border border-[#232838] bg-[#11141c]">
            <div className="border-b border-[#232838] px-4 py-2 text-[11px] font-medium tracking-wider text-[#6b7489] uppercase">
              Source ({currentFile.extension === "txt" ? "Plain Text" : "Markdown"}) · Ctrl/Cmd + S to save
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note..."
              className="min-h-[480px] w-full flex-1 resize-none bg-[#0e1118] p-5 font-mono text-sm leading-6 text-[#eef1f7] placeholder:text-[#6b7489] focus:outline-none"
            />
          </div>
        )}

        {isMarkdown && (viewMode === "preview" || viewMode === "split") && (
          <div className="flex flex-col overflow-hidden rounded-xl border border-[#232838] bg-[#11141c]">
            <div className="border-b border-[#232838] px-4 py-2 text-[11px] font-medium tracking-wider text-[#6b7489] uppercase">
              Preview
            </div>
            <div className="min-h-[480px] flex-1 overflow-y-auto p-6">
              {content.trim() ? (
                <MarkdownRenderer content={content} />
              ) : (
                <p className="text-sm text-[#6b7489]">
                  Nothing to preview yet. Start typing in the editor.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <RenameItemDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
      />

      <DeleteConfirmDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => router.push(backHref)}
      />

      <AlertDialog
        open={Boolean(pendingNavHref)}
        onOpenChange={(v) => !v && setPendingNavHref(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits in &ldquo;{currentFile.name}&rdquo;. Leaving
              now will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay in Editor</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const dest = pendingNavHref;
                setPendingNavHref(null);
                if (dest) router.push(dest);
              }}
            >
              Discard &amp; Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
