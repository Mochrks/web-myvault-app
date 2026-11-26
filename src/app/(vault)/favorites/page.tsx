import type { Metadata } from "next";
import { FileTable } from "@/components/file-manager/file-table";

export const metadata: Metadata = {
  title: "favorites",
};

export default function FavoritesPage() {
  return <FileTable folderId={null} favoritesOnly />;
}
