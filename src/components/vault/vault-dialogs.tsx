"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { upload as blobClientUpload } from "@vercel/blob/client";
import {
  CheckCircle2,
  FileUp,
  FolderPlus,
  Loader2,
  NotebookPen,
  Search,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  onProgress: (pct: number) => void,
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
            new Error(
              parsed?.error?.message || `Upload failed (${xhr.status})`,
            ),
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
      closeNewFolderDialog();
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
            <FolderPlus className="h-4 w-4 text-indigo-400" />
            New Folder
          </DialogTitle>
          <DialogDescription>
            Location: {getFolderPathLabel(newFolderParentId ?? null)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <Input
            placeholder="e.g. Golang, Notes, Contracts"
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
              onClick={closeNewFolderDialog}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
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
  const router = useRouter();
  const {
    newNoteFolderId,
    closeNewNoteDialog,
    setMetadata,
    getFolderPathLabel,
  } = useVault();
  const [name, setName] = React.useState("");
  const [format, setFormat] = React.useState<"md" | "txt">("md");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const open = newNoteFolderId !== undefined;

  const handleClose = () => {
    setName("");
    setFormat("md");
    setError(null);
    closeNewNoteDialog();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = name.trim();
    if (!raw) {
      setError("Note title is required.");
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
          folderId: newNoteFolderId ?? null,
          content: initialContent,
        }),
      });
      setMetadata(res.metadata);
      toast.success(`Note "${res.file.name}" created`);
      closeNewNoteDialog();
      router.push(`/notes/${res.file.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create note.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="h-4 w-4 text-violet-400" />
            New Note
          </DialogTitle>
          <DialogDescription>
            Location: {getFolderPathLabel(newNoteFolderId ?? null)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="e.g. redis-patterns"
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
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="md">.md</SelectItem>
                <SelectItem value="txt">.txt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeNewNoteDialog}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create & Open"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
          x.id === item.id ? { ...x, status: "uploading", progress: 5 } : x,
        ),
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
                  x.id === item.id ? { ...x, progress: pct } : x,
                ),
              );
            },
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
                    : x,
                ),
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
            x.id === item.id ? { ...x, status: "done", progress: 100 } : x,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed.";
        setItems((prev) =>
          prev.map((x) =>
            x.id === item.id ? { ...x, status: "error", error: message } : x,
          ),
        );
      }
    }

    setUploading(false);
    if (successCount > 0) {
      toast.success(
        `Uploaded ${successCount} file${successCount > 1 ? "s" : ""}`,
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
            <FileUp className="h-4 w-4 text-indigo-400" />
            Upload Files
          </DialogTitle>
          <DialogDescription>
            Target: {getFolderPathLabel(uploadTargetFolderId ?? null)} · Max{" "}
            {maxUploadSizeMb} MB per file (stored in private Blob)
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
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
            dragActive
              ? "border-indigo-500 bg-indigo-500/10"
              : "border-[#2f364b] bg-[#0e1118] hover:border-indigo-500/60"
          }`}
        >
          <FileUp className="mb-2 h-7 w-7 text-indigo-400" />
          <p className="text-sm font-medium text-[#eef1f7]">
            Drop files here or click to browse
          </p>
          <p className="mt-1 text-xs text-[#6b7489]">
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
                className="rounded-lg border border-[#232838] bg-[#0e1118] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-[#eef1f7]">
                    {item.file.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[#6b7489]">
                      {formatBytes(item.file.size)}
                    </span>
                    {item.status === "done" && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    )}
                    {item.status === "error" && (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                    {item.status === "uploading" && (
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                    )}
                  </div>
                </div>
                {(item.status === "uploading" || item.status === "done") && (
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#1b202e]">
                    <div
                      className={`h-full transition-all ${
                        item.status === "done"
                          ? "bg-emerald-500"
                          : "bg-indigo-500"
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
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
            onClick={closeUploadDialog}
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
                <Loader2 className="h-4 w-4 animate-spin" />
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
  } = useVault();
  const [query, setQuery] = React.useState("");

  const normalized = query.trim().toLowerCase();

  const matchingFolders = React.useMemo(() => {
    if (!normalized) return metadata.folders.slice(0, 5);
    return metadata.folders
      .filter((f) => f.name.toLowerCase().includes(normalized))
      .slice(0, 12);
  }, [metadata.folders, normalized]);

  const matchingFiles = React.useMemo(() => {
    if (!normalized) return metadata.files.slice(0, 8);
    return metadata.files
      .filter((f) => f.name.toLowerCase().includes(normalized))
      .slice(0, 20);
  }, [metadata.files, normalized]);

  return (
    <Dialog
      open={activeSearchOpen}
      onOpenChange={(v) => {
        if (!v) setQuery("");
        setActiveSearchOpen(v);
      }}
    >
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#232838] px-4 py-3">
          <Search className="h-4 w-4 text-[#6b7489]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search folders and files across vault..."
            autoFocus
            className="w-full bg-transparent text-sm text-[#eef1f7] placeholder:text-[#6b7489] focus:outline-none"
          />
          <Badge>ESC</Badge>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {matchingFolders.length === 0 && matchingFiles.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#6b7489]">
              No folders or files match &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <div className="space-y-3">
              {matchingFolders.length > 0 && (
                <div>
                  <p className="px-2.5 py-1 text-[11px] font-semibold tracking-wider text-[#6b7489] uppercase">
                    Folders
                  </p>
                  <div className="space-y-0.5">
                    {matchingFolders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => {
                          setActiveSearchOpen(false);
                          router.push(`/files/${folder.id}`);
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-[#171b26] cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <VaultEntryIcon type="folder" />
                          <span className="truncate font-medium text-[#eef1f7]">
                            {folder.name}
                          </span>
                        </div>
                        <span className="truncate text-[11px] text-[#6b7489]">
                          {getFolderPathLabel(folder.parentId)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {matchingFiles.length > 0 && (
                <div>
                  <p className="px-2.5 py-1 text-[11px] font-semibold tracking-wider text-[#6b7489] uppercase">
                    Files
                  </p>
                  <div className="space-y-0.5">
                    {matchingFiles.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => {
                          setActiveSearchOpen(false);
                          if (file.kind === "note") {
                            router.push(`/notes/${file.id}`);
                          } else {
                            const targetRoute = file.folderId
                              ? `/files/${file.folderId}`
                              : "/files";
                            router.push(targetRoute);
                            setPreviewFile(file);
                          }
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-[#171b26] cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <VaultEntryIcon type="file" kind={file.kind} />
                          <span className="truncate font-medium text-[#eef1f7]">
                            {file.name}
                          </span>
                        </div>
                        <span className="truncate text-[11px] text-[#6b7489]">
                          {getFolderPathLabel(file.folderId)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
