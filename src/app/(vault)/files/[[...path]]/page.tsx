import type { Metadata } from "next";
import { FileTable } from "@/components/file-manager/file-table";
import { VaultService } from "@/lib/metadata/vault-service";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<{ kind?: string }>;
}): Promise<Metadata> {
  const { path } = await params;
  const { kind } = await searchParams;
  const folderId = path && path.length > 0 ? path[path.length - 1] : null;

  if (!folderId) {
    if (kind === "markdown") return { title: "markdown" };
    if (kind === "note") return { title: "notes" };
    return { title: "files" };
  }

  try {
    const vault = new VaultService();
    const metadata = await vault.getMetadata();
    const folder = metadata.folders.find((f) => f.id === folderId);
    if (folder?.name) {
      return { title: folder.name.toLowerCase() };
    }
  } catch {
    // Fallback to generic title if storage is temporarily unreachable
  }

  return { title: "files" };
}

export default async function FilesPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  const folderId = path && path.length > 0 ? path[path.length - 1] : null;

  return <FileTable folderId={folderId} />;
}
