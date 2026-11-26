"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Code2,
  Columns2,
  Copy,
  Download,
  ListTree,
  Loader2,
  MoreHorizontal,
  Pencil,
  Save,
  Sparkles,
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VaultPageHeader } from "@/components/layout/vault-header-context";
import { MarkdownRenderer } from "@/components/notes/markdown-renderer";
import { DocumentOutline } from "@/components/notes/tiptap/document-outline";
import {
  TiptapMarkdownEditor,
  type TiptapEditorHandle,
} from "@/components/notes/tiptap/tiptap-editor";
import {
  DeleteConfirmDialog,
  RenameItemDialog,
  type ActionTarget,
} from "@/components/vault/file-action-dialogs";
import { useVault } from "@/components/vault/vault-provider";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { formatBytes, formatExactDate } from "@/lib/utils/format";
import type { VaultFile, VaultMetadataIndex } from "@/types/vault";

type EditorMode = "rich" | "source" | "split";

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

  const currentFile = metadata.files.find((f) => f.id === fileId) ?? initialFile;

  const isMarkdown = currentFile.extension === "md" || currentFile.extension === "markdown";
  const docLabel = isMarkdown ? "Markdown" : "Note";

  const [content, setContent] = React.useState(initialContent);
  const [savedContent, setSavedContent] = React.useState(initialContent);
  const [saving, setSaving] = React.useState(false);
  const [mode, setMode] = React.useState<EditorMode>(isMarkdown ? "rich" : "source");
  const [outlineOpen, setOutlineOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<ActionTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ActionTarget | null>(null);
  const [pendingNavHref, setPendingNavHref] = React.useState<string | null>(null);

  const tiptapRef = React.useRef<TiptapEditorHandle>(null);

  const isDirty = content !== savedContent;

  const stats = React.useMemo(() => {
    const trimmed = content.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = content.length;
    const readMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readMinutes };
  }, [content]);

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
      toast.success(`${docLabel} saved`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Failed to save ${docLabel.toLowerCase()}.`
      );
    } finally {
      setSaving(false);
    }
  }, [content, docLabel, fileId, isDirty, saving, setMetadata]);

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
      toast.success(`${docLabel} copied to clipboard`);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(`Failed to copy ${docLabel.toLowerCase()} content`);
    }
  };

  const handleUploadInlineImage = React.useCallback(
    async (file: File): Promise<string | null> => {
      const toastId = toast.loading(`Uploading ${file.name}...`);
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (currentFile.folderId) {
          formData.append("folderId", currentFile.folderId);
        }
        const res = await fetch("/api/vault/upload", {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json?.error?.message || "Image upload failed.");
        }
        setMetadata(json.data.metadata);
        toast.success("Image inserted into note", { id: toastId });
        return `/api/vault/files/${json.data.file.id}/content`;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Image upload failed.", { id: toastId });
        return null;
      }
    },
    [currentFile.folderId, setMetadata]
  );

  const backHref = currentFile.folderId ? `/files/${currentFile.folderId}` : "/files";

  const attemptNavigate = (href: string) => {
    if (isDirty) setPendingNavHref(href);
    else router.push(href);
  };

  return (
    <>
      {/* Single Context-Aware Header — Zero Stacked Bars! */}
      <VaultPageHeader
        left={
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => attemptNavigate(backHref)}
              className="shrink-0 gap-1 px-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>

            <button
              type="button"
              onClick={() => setRenameTarget({ kind: "file", item: currentFile })}
              className="group flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-accent cursor-pointer"
              title="Click to rename"
            >
              <span className="truncate text-sm font-medium text-foreground">
                {currentFile.name}
              </span>
              <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>

            <span
              className={cn(
                "hidden shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium sm:inline-flex",
                isDirty
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-400"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isDirty ? "bg-amber-400" : "bg-emerald-400"
                )}
              />
              {isDirty ? "Unsaved" : "Saved"}
            </span>
          </div>
        }
        right={
          <div className="flex items-center gap-1.5">
            {isMarkdown && (
              <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setMode("rich")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
                    mode === "rich"
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Rich</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("source")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
                    mode === "source"
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Code2 className="h-3 w-3" />
                  <span>Source</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("split")}
                  className={cn(
                    "hidden md:inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
                    mode === "split"
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Columns2 className="h-3 w-3" />
                  <span>Split</span>
                </button>
              </div>
            )}

            {isMarkdown && mode === "rich" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={outlineOpen ? "secondary" : "ghost"}
                    size="icon-sm"
                    onClick={() => setOutlineOpen((v) => !v)}
                    className="hidden lg:inline-flex"
                    aria-label="Toggle document outline"
                  >
                    <ListTree className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Document Outline</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="h-8 gap-1.5"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="hidden sm:inline">Saving</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Save</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Save changes (Ctrl+S)</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="h-8 w-8"
                  aria-label="More note actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={handleCopyContent}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied!" : `Copy ${docLabel}`}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/api/vault/files/${fileId}/download`} prefetch={false}>
                    <Download className="h-3.5 w-3.5" />
                    Download {docLabel}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setRenameTarget({ kind: "file", item: currentFile })}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rename {docLabel}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  destructive
                  onSelect={() => setDeleteTarget({ kind: "file", item: currentFile })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete {docLabel}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Full-Height Editor Workspace */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {isMarkdown && mode === "rich" ? (
            <>
              <TiptapMarkdownEditor
                editorRef={tiptapRef}
                value={content}
                onChange={setContent}
                onUploadImage={handleUploadInlineImage}
              />
              {outlineOpen && (
                <div className="hidden lg:flex">
                  <DocumentOutline
                    markdown={content}
                    onSelectHeading={(text) => tiptapRef.current?.scrollToHeading(text)}
                    onClose={() => setOutlineOpen(false)}
                  />
                </div>
              )}
            </>
          ) : (
            <div
              className={cn(
                "grid min-h-0 flex-1 divide-border overflow-hidden",
                isMarkdown && mode === "split"
                  ? "grid-cols-1 lg:grid-cols-2 lg:divide-x"
                  : "grid-cols-1"
              )}
            >
              <div className="flex min-h-0 flex-col bg-background">
                <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-card/50 px-4 text-[11px] font-medium text-muted-foreground">
                  <span>{isMarkdown ? "Markdown Source" : "Notes (.txt)"}</span>
                  <span className="font-mono text-[10px]">Ctrl/Cmd + S</span>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={isMarkdown ? "Write your markdown..." : "Write your note..."}
                  className="min-h-0 w-full flex-1 resize-none bg-background p-6 font-mono text-sm leading-7 text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                />
              </div>

              {isMarkdown && mode === "split" && (
                <div className="flex min-h-0 flex-col bg-background">
                  <div className="flex h-9 shrink-0 items-center border-b border-border bg-card/50 px-4 text-[11px] font-medium text-muted-foreground">
                    Live Preview
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
                    {content.trim() ? (
                      <MarkdownRenderer content={content} />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nothing to preview yet. Start typing on the left.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Clean Bottom Status Bar */}
        <footer className="flex h-8 shrink-0 items-center justify-between gap-4 border-t border-border bg-card/50 px-4 text-[11px] text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2 truncate">
            <span className="truncate">{getFolderPathLabel(currentFile.folderId)}</span>
            <span className="text-border">·</span>
            <span className="font-mono tabular-nums">{formatBytes(currentFile.size)}</span>
            <span className="hidden text-border sm:inline">·</span>
            <span className="hidden truncate sm:inline">
              Updated {formatExactDate(currentFile.updatedAt)}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3 font-mono tabular-nums">
            <span>{stats.words} words</span>
            <span className="hidden sm:inline">{stats.chars} chars</span>
            <span className="hidden md:inline">~{stats.readMinutes} min read</span>
          </div>
        </footer>
      </div>

      <RenameItemDialog target={renameTarget} onClose={() => setRenameTarget(null)} />

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
              You have unsaved edits in &ldquo;{currentFile.name}&rdquo;. Leaving now will discard
              them.
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
    </>
  );
}
