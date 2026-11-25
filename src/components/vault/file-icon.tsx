import {
  Archive,
  File,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  NotebookPen,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { FileKind } from "@/types/vault";

export function VaultEntryIcon({
  type,
  kind,
  open = false,
  className,
}: {
  type: "folder" | "file";
  kind?: FileKind;
  open?: boolean;
  className?: string;
}) {
  if (type === "folder") {
    const Icon = open ? FolderOpen : Folder;
    return <Icon className={cn("h-4 w-4 text-indigo-400 shrink-0", className)} />;
  }

  switch (kind) {
    case "code":
      return <FileCode2 className={cn("h-4 w-4 text-sky-400 shrink-0", className)} />;
    case "note":
      return <NotebookPen className={cn("h-4 w-4 text-violet-400 shrink-0", className)} />;
    case "text":
      return <FileText className={cn("h-4 w-4 text-slate-300 shrink-0", className)} />;
    case "spreadsheet":
      return <FileSpreadsheet className={cn("h-4 w-4 text-emerald-400 shrink-0", className)} />;
    case "pdf":
      return <FileText className={cn("h-4 w-4 text-rose-400 shrink-0", className)} />;
    case "image":
      return <FileImage className={cn("h-4 w-4 text-amber-400 shrink-0", className)} />;
    case "archive":
      return <Archive className={cn("h-4 w-4 text-orange-400 shrink-0", className)} />;
    case "document":
      return <FileText className={cn("h-4 w-4 text-blue-400 shrink-0", className)} />;
    default:
      return <File className={cn("h-4 w-4 text-[#98a2b3] shrink-0", className)} />;
  }
}
