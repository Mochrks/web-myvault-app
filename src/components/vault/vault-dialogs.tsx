"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { upload as blobClientUpload } from "@vercel/blob/client";
import {
  CheckCircle2,
  FileUp,
  Files,
  FolderPlus,
  LayoutDashboard,
  Loader2,
  NotebookPen,
  Star,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VaultEntryIcon } from "@/components/vault/file-icon";
import { useVault } from "@/components/vault/vault-provider";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { formatBytes } from "@/lib/utils/format";
import type { VaultFile, VaultFolder, VaultMetadataIndex } from "@/types/vault";

const SERVER_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024; // 4 MB

interface UploadItemState {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

function uploadViaServerWithProgress(
  file: File,
  folderId: string | null,
  onProgress: (pct: number) => void
): Promise<{ file: VaultFile; metadata: VaultMetadataIndex }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    if (folderId) {
      formData.append("folderId", folderId);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/vault/upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && parsed.success) {
          resolve(parsed.data);
        } else {
          reject(
            new Error(parsed?.error?.message || `Upload failed (${xhr.status})`)
          );
        }
      } catch {
        reject(new Error(`Unexpected response (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(formData);
  });
}

export function VaultGlobalDialogs() {
  return (
    <>
      <CreateFolderDialog />
      <CreateNoteDialog />
      <UploadFilesDialog />
      <GlobalSearchDialog />
    </>
  );
}

function CreateFolderDialog() {
  const {
    newFolderParentId,
    closeNewFolderDialog,
    setMetadata,
    getFolderPathLabel,
  } = useVault();
  const [name, setName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const open = newFolderParentId !== undefined;

  const handleClose = () => {
    setName("");
    setError(null);
    closeNewFolderDialog();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Folder name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiRequest<{
        folder: VaultFolder;
        metadata: VaultMetadataIndex;
      }>("/api/vault/folders", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          parentId: newFolderParentId ?? null,
        }),
      });
      setMetadata(res.metadata);
      toast.success(`Folder "${res.folder.name}" created`);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-4 w-4 text-muted-foreground" />
            New Folder
          </DialogTitle>
          <DialogDescription>
            Location: {getFolderPathLabel(newFolderParentId ?? null)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <Input
            placeholder="e.g. Architecture, Notes, Contracts"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            disabled={submitting}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Folder"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateNoteDialog() {
  const { newNoteFolderId, newNoteDefaultFormat, closeNewNoteDialog } =
    useVault();
  const open = newNoteFolderId !== undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeNewNoteDialog()}>
      {open && (
        <CreateNoteDialogContent
          key={`${newNoteFolderId ?? "root"}-${newNoteDefaultFormat}`}
          folderId={newNoteFolderId ?? null}
          defaultFormat={newNoteDefaultFormat}
          onClose={closeNewNoteDialog}
        />
      )}
    </Dialog>
  );
}

function CreateNoteDialogContent({
  folderId,
  defaultFormat,
  onClose,
}: {
  folderId: string | null;
  defaultFormat: "md" | "txt";
  onClose: () => void;
}) {
  const router = useRouter();
  const { setMetadata, getFolderPathLabel } = useVault();
  const [name, setName] = React.useState("");
  const [format, setFormat] = React.useState<"md" | "txt">(defaultFormat);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isMd = format === "md";
  const label = isMd ? "Markdown" : "Note";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = name.trim();
    if (!raw) {
      setError(`${label} title is required.`);
      return;
    }

    const lower = raw.toLowerCase();
    const finalName =
      lower.endsWith(".md") ||
      lower.endsWith(".markdown") ||
      lower.endsWith(".txt")
        ? raw
        : `${raw}.${format}`;

    setSubmitting(true);
    setError(null);
    try {
      const initialContent = finalName.toLowerCase().endsWith(".txt")
        ? ""
        : `# ${raw.replace(/\.(md|markdown|txt)$/i, "")}\n\n`;

      const res = await apiRequest<{
        file: VaultFile;
        metadata: VaultMetadataIndex;
      }>("/api/vault/files", {
        method: "POST",
        body: JSON.stringify({
          name: finalName,
          folderId,
          content: initialContent,
        }),
      });
      setMetadata(res.metadata);
      toast.success(`${label} "${res.file.name}" created`);
      onClose();
      router.push(`/notes/${res.file.id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to create ${label.toLowerCase()}.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-muted-foreground" />
          New {label}
        </DialogTitle>
        <DialogDescription>
          Location: {getFolderPathLabel(folderId)}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder={isMd ? "e.g. system-design" : "e.g. quick-notes"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            disabled={submitting}
            className="flex-1"
          />
          <Select
            value={format}
            onValueChange={(v) => setFormat(v as "md" | "txt")}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="md">Markdown (.md)</SelectItem>
              <SelectItem value="txt">Notes (.txt)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating...
              </>
            ) : (
              `Create ${label}`
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function UploadFilesDialog() {
  const {
    uploadTargetFolderId,
    closeUploadDialog,
    maxUploadSizeMb,
    setMetadata,
    getFolderPathLabel,
  } = useVault();
  const [items, setItems] = React.useState<UploadItemState[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const open = uploadTargetFolderId !== undefined;
  const maxBytes = maxUploadSizeMb * 1024 * 1024;

  const handleClose = () => {
    setItems([]);
    setUploading(false);
    setDragActive(false);
    closeUploadDialog();
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const incoming: UploadItemState[] = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
      progress: 0,
      status: file.size > maxBytes ? "error" : "pending",
      error:
        file.size > maxBytes
          ? `Exceeds ${maxUploadSizeMb} MB limit`
          : undefined,
    }));
    setItems((prev) => [...prev, ...incoming]);
  };

  const handleUploadAll = async () => {
    const pending = items.filter((item) => item.status === "pending");
    if (pending.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (const item of pending) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === item.id ? { ...x, status: "uploading", progress: 5 } : x
        )
      );

      try {
        let latestMeta: VaultMetadataIndex;
        if (item.file.size <= SERVER_UPLOAD_THRESHOLD_BYTES) {
          const result = await uploadViaServerWithProgress(
            item.file,
            uploadTargetFolderId ?? null,
            (pct) => {
              setItems((prev) =>
                prev.map((x) =>
                  x.id === item.id ? { ...x, progress: pct } : x
                )
              );
            }
          );
          latestMeta = result.metadata;
        } else {
          const year = new Date().getUTCFullYear();
          const objectKey = `myvault/objects/${year}/${crypto.randomUUID()}`;
          const uploadedBlob = await blobClientUpload(objectKey, item.file, {
            access: "private",
            handleUploadUrl: "/api/vault/upload/token",
            multipart: true,
            clientPayload: JSON.stringify({
              name: item.file.name,
              folderId: uploadTargetFolderId ?? null,
              size: item.file.size,
              mimeType: item.file.type || "application/octet-stream",
            }),
            onUploadProgress: (evt) => {
              setItems((prev) =>
                prev.map((x) =>
                  x.id === item.id
                    ? { ...x, progress: Math.round(evt.percentage) }
                    : x
                )
              );
            },
          });

          const registered = await apiRequest<{
            file: VaultFile;
            metadata: VaultMetadataIndex;
          }>("/api/vault/files", {
            method: "POST",
            body: JSON.stringify({
              name: item.file.name,
              folderId: uploadTargetFolderId ?? null,
              objectKey: uploadedBlob.pathname,
              mimeType: item.file.type || uploadedBlob.contentType,
            }),
          });
          latestMeta = registered.metadata;
        }

        setMetadata(latestMeta);
        successCount += 1;
        setItems((prev) =>
          prev.map((x) =>
            x.id === item.id ? { ...x, status: "done", progress: 100 } : x
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed.";
        setItems((prev) =>
          prev.map((x) =>
            x.id === item.id ? { ...x, status: "error", error: message } : x
          )
        );
      }
    }

    setUploading(false);
    if (successCount > 0) {
      toast.success(
        `Uploaded ${successCount} file${successCount > 1 ? "s" : ""}`
      );
    }
  };

  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !uploading) handleClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-4 w-4 text-muted-foreground" />
            Upload Files
          </DialogTitle>
          <DialogDescription>
            Target: {getFolderPathLabel(uploadTargetFolderId ?? null)} · Max{" "}
            {maxUploadSizeMb} MB per file
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => !uploading && inputRef.current?.click()}
          className={cn(
            "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
            dragActive
              ? "border-foreground/60 bg-accent/60"
              : "border-border bg-background hover:border-muted-foreground/50 hover:bg-card/60"
          )}
        >
          <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card">
            <FileUp className="h-5 w-5 text-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">
            Drop files here or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Code, notes, PDFs, Office docs, spreadsheets, archives, images,
            binaries
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {items.length > 0 && (
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-foreground">
                    {item.file.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-muted-foreground">
                      {formatBytes(item.file.size)}
                    </span>
                    {item.status === "done" && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    )}
                    {item.status === "error" && (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                    {item.status === "uploading" && (
                      <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                    )}
                  </div>
                </div>
                {(item.status === "uploading" || item.status === "done") && (
                  <Progress value={item.progress} className="mt-2 h-1" />
                )}
                {item.error && (
                  <p className="mt-1 text-[11px] text-red-400">{item.error}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={uploading}
          >
            {items.some((i) => i.status === "done") && pendingCount === 0
              ? "Done"
              : "Cancel"}
          </Button>
          <Button
            type="button"
            onClick={handleUploadAll}
            disabled={uploading || pendingCount === 0}
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading...
              </>
            ) : (
              `Upload (${pendingCount})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GlobalSearchDialog() {
  const router = useRouter();
  const {
    metadata,
    activeSearchOpen,
    setActiveSearchOpen,
    getFolderPathLabel,
    setPreviewFile,
    openNewFolderDialog,
    openNewNoteDialog,
    openUploadDialog,
  } = useVault();

  const runAction = (fn: () => void) => {
    setActiveSearchOpen(false);
    fn();
  };

  return (
    <CommandDialog
      open={activeSearchOpen}
      onOpenChange={setActiveSearchOpen}
      title="Search Vault & Commands"
    >
      <CommandInput placeholder="Search files, folders, or run a command..." />
      <CommandList>
        <CommandEmpty>No matching files, folders, or commands.</CommandEmpty>

        <CommandGroup heading="Quick Actions">
          <CommandItem
            onSelect={() => runAction(() => openNewNoteDialog(null, "md"))}
          >
            <NotebookPen className="h-4 w-4 text-muted-foreground" />
            <span>New Markdown (.md)</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runAction(() => openNewNoteDialog(null, "txt"))}
          >
            <NotebookPen className="h-4 w-4 text-muted-foreground" />
            <span>New Note (.txt)</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runAction(() => openUploadDialog(null))}
          >
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span>Upload Files</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runAction(() => openNewFolderDialog(null))}
          >
            <FolderPlus className="h-4 w-4 text-muted-foreground" />
            <span>New Folder</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runAction(() => router.push("/dashboard"))}>
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            <span>Go to Dashboard</span>
            <CommandShortcut>Home</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => router.push("/files"))}>
            <Files className="h-4 w-4 text-muted-foreground" />
            <span>Go to All Files</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => router.push("/favorites"))}>
            <Star className="h-4 w-4 text-muted-foreground" />
            <span>Go to Favorites</span>
          </CommandItem>
        </CommandGroup>

        {metadata.folders.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Folders">
              {metadata.folders.slice(0, 30).map((folder) => (
                <CommandItem
                  key={folder.id}
                  value={`folder ${folder.name} ${getFolderPathLabel(folder.parentId)}`}
                  onSelect={() =>
                    runAction(() => router.push(`/files/${folder.id}`))
                  }
                >
                  <VaultEntryIcon type="folder" />
                  <span className="truncate font-medium">{folder.name}</span>
                  <span className="ml-auto truncate text-[11px] text-muted-foreground">
                    {getFolderPathLabel(folder.parentId)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {metadata.files.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Files">
              {metadata.files.slice(0, 50).map((file) => (
                <CommandItem
                  key={file.id}
                  value={`file ${file.name} ${getFolderPathLabel(file.folderId)}`}
                  onSelect={() =>
                    runAction(() => {
                      if (
                        file.extension === "md" ||
                        file.extension === "markdown" ||
                        file.extension === "txt"
                      ) {
                        router.push(`/notes/${file.id}`);
                      } else {
                        router.push(
                          file.folderId ? `/files/${file.folderId}` : "/files"
                        );
                        setPreviewFile(file);
                      }
                    })
                  }
                >
                  <VaultEntryIcon type="file" kind={file.kind} />
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="ml-auto truncate text-[11px] text-muted-foreground">
                    {getFolderPathLabel(file.folderId)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
