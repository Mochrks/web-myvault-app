import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoteEditorClient } from "@/components/notes/note-editor-client";
import { NoteErrorState } from "@/components/notes/note-error-state";
import { VaultAppError } from "@/lib/api/response";
import { VaultService } from "@/lib/metadata/vault-service";
import { getBlobStorageAdapter } from "@/lib/storage/blob-storage";
import { isTextReadableFile } from "@/lib/utils/file-types";
import { formatBytes } from "@/lib/utils/format";
import type { VaultFile } from "@/types/vault";

export const dynamic = "force-dynamic";

const loadNoteFile = cache(async (id: string) => {
  const vault = new VaultService();
  return vault.getFileById(id);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const file = await loadNoteFile(id);
    if (file?.name) {
      return { title: file.name.toLowerCase() };
    }
  } catch {
    // Fallback title on transient read failure
  }
  return { title: "notes" };
}

const MAX_INLINE_EDITOR_BYTES = 2 * 1024 * 1024; // 2 MB safeguard to prevent UI freeze

async function streamToUtf8(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let file: VaultFile;
  try {
    file = await loadNoteFile(id);
  } catch (err) {
    if (err instanceof VaultAppError && err.code === "FILE_NOT_FOUND") {
      notFound();
    }
    const message =
      err instanceof Error
        ? err.message
        : "Unable to connect to private object storage right now.";
    return (
      <NoteErrorState
        title="Could not load note"
        description={message}
        backHref="/files"
      />
    );
  }

  const backHref = file.folderId ? `/files/${file.folderId}` : "/files";

  if (!isTextReadableFile(file.kind, file.extension)) {
    return (
      <NoteErrorState
        title="Not a text-editable note"
        description={`${file.name} cannot be opened in the note editor. You can preview or download it directly.`}
        backHref={backHref}
        downloadHref={`/api/vault/files/${file.id}/download`}
        canRetry={false}
      />
    );
  }

  if (file.size > MAX_INLINE_EDITOR_BYTES) {
    return (
      <NoteErrorState
        title="File too large for inline editor"
        description={`${file.name} is ${formatBytes(file.size)}. To keep the browser responsive, files over 2 MB are downloaded instead of edited inline.`}
        backHref={backHref}
        downloadHref={`/api/vault/files/${file.id}/download`}
        canRetry={false}
      />
    );
  }

  let content: string;
  try {
    const storage = getBlobStorageAdapter();
    const obj = await storage.getPrivateObjectStream(file.objectKey);
    content = await streamToUtf8(obj.stream);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to read file content from private object storage.";
    return (
      <NoteErrorState
        title={`Could not open "${file.name}"`}
        description={message}
        backHref={backHref}
        downloadHref={`/api/vault/files/${file.id}/download`}
      />
    );
  }

  return (
    <NoteEditorClient
      fileId={file.id}
      initialFile={file}
      initialContent={content}
    />
  );
}
