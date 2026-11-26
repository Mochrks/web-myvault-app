"use client";

import * as React from "react";
import { Copy, Loader2, Pencil, Trash2 } from "lucide-react";
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
import { useVault } from "@/components/vault/vault-provider";
import { apiRequest } from "@/lib/api/client";
import type { VaultFile, VaultFolder, VaultMetadataIndex } from "@/types/vault";

export type ActionTarget =
  | { kind: "folder"; item: VaultFolder }
  | { kind: "file"; item: VaultFile };

export function RenameItemDialog({
  target,
  onClose,
}: {
  target: ActionTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(v) => !v && onClose()}>
      {target && (
        <RenameItemDialogContent
          key={`${target.kind}:${target.item.id}`}
          target={target}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function RenameItemDialogContent({
  target,
  onClose,
}: {
  target: ActionTarget;
  onClose: () => void;
}) {
  const { setMetadata } = useVault();
  const [name, setName] = React.useState(target.item.name);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    if (!name.trim()) {
      setError("Name cannot be empty.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const endpoint =
        target.kind === "folder"
          ? `/api/vault/folders/${target.item.id}`
          : `/api/vault/files/${target.item.id}`;
      const res = await apiRequest<{ metadata: VaultMetadataIndex }>(endpoint, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      setMetadata(res.metadata);
      toast.success(`Renamed to "${name.trim()}"`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Pencil className="h-4 w-4 text-muted-foreground" />
          Rename {target.kind === "folder" ? "Folder" : "File"}
        </DialogTitle>
        <DialogDescription>
          Enter a new name for &ldquo;{target.item.name}&rdquo;.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          disabled={saving}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Name"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function CopyItemDialog({
  target,
  onClose,
}: {
  target: ActionTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(v) => !v && onClose()}>
      {target && (
        <CopyItemDialogContent
          key={`${target.kind}:${target.item.id}`}
          target={target}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function CopyItemDialogContent({
  target,
  onClose,
}: {
  target: ActionTarget;
  onClose: () => void;
}) {
  const { metadata, setMetadata, getFolderPathLabel } = useVault();
  const initialParent =
    target.kind === "folder" ? target.item.parentId : target.item.folderId;
  const [destinationId, setDestinationId] = React.useState<string>(
    initialParent ?? "__root__"
  );
  const [newName, setNewName] = React.useState("");
  const [copying, setCopying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const blockedFolderIds = React.useMemo(() => {
    if (target.kind !== "folder") return new Set<string>();
    const blocked = new Set<string>([target.item.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of metadata.folders) {
        if (f.parentId && blocked.has(f.parentId) && !blocked.has(f.id)) {
          blocked.add(f.id);
          changed = true;
        }
      }
    }
    return blocked;
  }, [target, metadata.folders]);

  const availableFolders = React.useMemo(
    () =>
      metadata.folders
        .filter((f) => !blockedFolderIds.has(f.id))
        .sort((a, b) =>
          getFolderPathLabel(a.id).localeCompare(getFolderPathLabel(b.id))
        ),
    [metadata.folders, blockedFolderIds, getFolderPathLabel]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;

    setCopying(true);
    setError(null);
    const resolvedFolderId =
      destinationId === "__root__" ? null : destinationId;

    try {
      if (target.kind === "folder") {
        const res = await apiRequest<{
          folder: VaultFolder;
          metadata: VaultMetadataIndex;
        }>(`/api/vault/folders/${target.item.id}/copy`, {
          method: "POST",
          body: JSON.stringify({
            targetParentId: resolvedFolderId,
            ...(newName.trim() ? { newName: newName.trim() } : {}),
          }),
        });
        setMetadata(res.metadata);
        toast.success(`Folder copied as "${res.folder.name}"`);
      } else {
        const res = await apiRequest<{
          file: VaultFile;
          metadata: VaultMetadataIndex;
        }>(`/api/vault/files/${target.item.id}/copy`, {
          method: "POST",
          body: JSON.stringify({
            targetFolderId: resolvedFolderId,
            ...(newName.trim() ? { newName: newName.trim() } : {}),
          }),
        });
        setMetadata(res.metadata);
        toast.success(`File copied as "${res.file.name}"`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy failed.");
    } finally {
      setCopying(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Copy className="h-4 w-4 text-muted-foreground" />
          Copy {target.kind === "folder" ? "Folder" : "File"}
        </DialogTitle>
        <DialogDescription>
          Duplicate &ldquo;{target.item.name}&rdquo; without modifying the
          original.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Destination Folder
          </label>
          <Select value={destinationId} onValueChange={setDestinationId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__root__">Root (All Files)</SelectItem>
              {availableFolders.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {getFolderPathLabel(folder.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            New Name (optional — auto-suffixed if left blank)
          </label>
          <Input
            placeholder={target.item.name}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={copying}
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={copying}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={copying}>
            {copying ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Copying...
              </>
            ) : (
              "Copy Here"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function DeleteConfirmDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: ActionTarget | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { setMetadata } = useVault();
  const [counts, setCounts] = React.useState<{
    id: string;
    subfolderCount: number;
    fileCount: number;
  } | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (!target || target.kind !== "folder") {
      return;
    }

    const folderId = target.item.id;
    apiRequest<{ subfolderCount: number; fileCount: number }>(
      `/api/vault/folders/${folderId}`
    )
      .then((res) => {
        if (active) setCounts({ id: folderId, ...res });
      })
      .catch(() => {
        if (active) setCounts(null);
      });

    return () => {
      active = false;
    };
  }, [target]);

  const visibleCounts =
    target?.kind === "folder" && counts?.id === target.item.id ? counts : null;

  const handleConfirm = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      const endpoint =
        target.kind === "folder"
          ? `/api/vault/folders/${target.item.id}`
          : `/api/vault/files/${target.item.id}`;
      const res = await apiRequest<{ metadata: VaultMetadataIndex }>(endpoint, {
        method: "DELETE",
      });
      setMetadata(res.metadata);
      toast.success(`Deleted "${target.item.name}"`);
      onDeleted?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={Boolean(target)} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-400">
            <Trash2 className="h-4 w-4" />
            Delete {target?.kind === "folder" ? "Folder" : "File"} Permanently?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {target?.kind === "folder" ? (
              <>
                This will permanently delete{" "}
                <strong className="text-foreground">{target.item.name}</strong>
                {visibleCounts
                  ? ` along with ${visibleCounts.subfolderCount} subfolder(s) and ${visibleCounts.fileCount} file(s)`
                  : " and all subfolders and files inside it"}
                . This action cannot be undone.
              </>
            ) : (
              <>
                This will permanently remove{" "}
                <strong className="text-foreground">
                  {target?.item.name}
                </strong>{" "}
                from private object storage. This action cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete Permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
