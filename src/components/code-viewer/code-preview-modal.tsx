"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileWarning,
  Loader2,
  NotebookPen,
  Table2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VaultEntryIcon } from "@/components/vault/file-icon";
import { apiRequest } from "@/lib/api/client";
import { isSafeRasterImage, isTextReadableFile } from "@/lib/utils/file-types";
import { formatBytes, formatExactDate } from "@/lib/utils/format";
import type { VaultFile } from "@/types/vault";

interface TextContentPayload {
  file: VaultFile;
  content: string;
  highlightedHtml: string | null;
  language: string;
}

function parseCsvPreview(raw: string, maxRows = 200): string[][] {
  const lines = raw
    .split(/\r?\n/)
    .filter((l) => l.length > 0)
    .slice(0, maxRows);
  return lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells;
  });
}

export function FilePreviewModal({
  file,
  onClose,
}: {
  file: VaultFile | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(file)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        {file && <FilePreviewModalContent key={file.id} file={file} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function FilePreviewModalContent({ file, onClose }: { file: VaultFile; onClose: () => void }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [textData, setTextData] = React.useState<TextContentPayload | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [csvMode, setCsvMode] = React.useState<"table" | "code">("table");

  const isText = isTextReadableFile(file.kind, file.extension);
  const isImage = isSafeRasterImage(file.extension);
  const isPdf = file.kind === "pdf";
  const isCsv = file.extension === "csv";

  React.useEffect(() => {
    if (!isText) return;

    let active = true;
    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    apiRequest<TextContentPayload>(`/api/vault/files/${file.id}/content?mode=text&highlight=1`)
      .then((res) => {
        if (active) setTextData(res);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load file preview.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [file.id, isText]);

  const handleCopyContent = async () => {
    if (!textData) return;
    try {
      await navigator.clipboard.writeText(textData.content);
      setCopied(true);
      toast.success("File content copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const csvRows = React.useMemo(() => {
    if (!isCsv || !textData?.content) return [];
    return parseCsvPreview(textData.content);
  }, [isCsv, textData]);

  return (
    <>
      <DialogHeader className="flex-col items-start justify-between gap-3 border-b border-border bg-card px-4 py-3.5 pr-12 sm:flex-row sm:items-center sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
            <VaultEntryIcon type="file" kind={file.kind} className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="truncate text-sm font-semibold">{file.name}</DialogTitle>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              {file.extension && (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  .{file.extension}
                </Badge>
              )}
              <span className="font-mono tabular-nums">{formatBytes(file.size)}</span>
              <span>·</span>
              <span>{formatExactDate(file.updatedAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {file.kind === "note" && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/notes/${file.id}`} onClick={onClose}>
                <NotebookPen className="h-3.5 w-3.5" />
                {file.extension === "md" || file.extension === "markdown"
                  ? "Edit Markdown"
                  : "Edit Note"}
              </Link>
            </Button>
          )}

          {isCsv && textData && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCsvMode((m) => (m === "table" ? "code" : "table"))}
            >
              {csvMode === "table" ? (
                <>
                  <Code2 className="h-3.5 w-3.5" />
                  Raw
                </>
              ) : (
                <>
                  <Table2 className="h-3.5 w-3.5" />
                  Table
                </>
              )}
            </Button>
          )}

          {textData && (
            <Button type="button" size="sm" variant="outline" onClick={handleCopyContent}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
          )}

          <Button asChild size="sm">
            <a href={`/api/vault/files/${file.id}/download`}>
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </Button>
        </div>
      </DialogHeader>

      <div className="flex-1 overflow-auto bg-background">
        {isText && (
          <>
            {loading && (
              <div className="flex h-64 items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                Loading file preview...
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <FileWarning className="h-9 w-9 text-amber-400" />
                <p className="max-w-md text-sm text-foreground">{error}</p>
                <Button asChild size="sm">
                  <a href={`/api/vault/files/${file.id}/download`}>
                    <Download className="h-3.5 w-3.5" />
                    Download Original File
                  </a>
                </Button>
              </div>
            )}

            {!loading && !error && textData && (
              <>
                {isCsv && csvMode === "table" && csvRows.length > 0 ? (
                  <div className="overflow-auto p-4">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-card">
                          {csvRows[0].map((cell, idx) => (
                            <th
                              key={idx}
                              className="border border-border px-3 py-2 text-left font-semibold text-foreground"
                            >
                              {cell}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(1).map((row, rIdx) => (
                          <tr key={rIdx} className="even:bg-card/40 hover:bg-secondary/50">
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className="border border-border px-3 py-1.5 text-foreground/85"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : textData.highlightedHtml ? (
                  <div
                    className="vault-shiki min-w-full overflow-x-auto"
                    dangerouslySetInnerHTML={{
                      __html: textData.highlightedHtml,
                    }}
                  />
                ) : (
                  <pre className="overflow-x-auto p-5 font-mono text-xs leading-6 text-foreground/90">
                    {textData.content}
                  </pre>
                )}
              </>
            )}
          </>
        )}

        {!isText && isImage && (
          <div className="flex min-h-[360px] items-center justify-center p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/vault/files/${file.id}/content`}
              alt={file.name}
              className="max-h-[70vh] max-w-full rounded-xl border border-border object-contain"
            />
          </div>
        )}

        {!isText && isPdf && (
          <div className="flex h-[75vh] flex-col">
            <iframe
              src={`/api/vault/files/${file.id}/content`}
              title={file.name}
              className="h-full w-full border-0 bg-background"
            />
            <div className="flex items-center justify-between border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
              <span>If your browser blocks inline PDF frames, open or download directly.</span>
              <a
                href={`/api/vault/files/${file.id}/content`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-foreground hover:underline"
              >
                Open in tab
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {!isText && !isImage && !isPdf && (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card">
              <VaultEntryIcon type="file" kind={file.kind} className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Preview is not available for .{file.extension || "binary"} files
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                Original binary contents are preserved intact in private storage ({file.mimeType} ·{" "}
                {formatBytes(file.size)}).
              </p>
            </div>
            <Button asChild size="sm">
              <a href={`/api/vault/files/${file.id}/download`}>
                <Download className="h-3.5 w-3.5" />
                Download Original File
              </a>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
