import { FileTable } from "@/components/file-manager/file-table";

export default async function FilesPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  const folderId = path && path.length > 0 ? path[path.length - 1] : null;

  return <FileTable folderId={folderId} />;
}
