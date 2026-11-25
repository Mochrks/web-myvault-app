import Link from "next/link";
import { notFound } from "next/navigation";
import { NoteEditorClient } from "@/components/notes/note-editor-client";
import { Button } from "@/components/ui/button";
import { VaultService } from "@/lib/metadata/vault-service";
import { getBlobStorageAdapter } from "@/lib/storage/blob-storage";
import { isTextReadableFile } from "@/lib/utils/file-types";

export const dynamic = "force-dynamic";

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
  const vault = new VaultService();
  const file = await vault.getFileById(id);

  if (!file) {
    notFound();
  }

  if (!isTextReadableFile(file.kind, file.extension)) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-lg font-semibold text-foreground">
          Not a text-editable note
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {file.name} cannot be opened in the note editor. You can preview or
          download it from the file manager.
        </p>
        <Button asChild className="mt-6">
          <Link href={file.folderId ? `/files/${file.folderId}` : "/files"}>
            Back to Folder
          </Link>
        </Button>
      </div>
    );
  }

  const storage = getBlobStorageAdapter();
  const obj = await storage.getPrivateObjectStream(file.objectKey);
  const content = await streamToUtf8(obj.stream);

  return (
    <NoteEditorClient
      fileId={file.id}
      initialFile={file}
      initialContent={content}
    />
  );
}
