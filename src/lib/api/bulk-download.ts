export interface BulkDownloadInput {
  fileIds: string[];
  folderIds: string[];
  archiveName?: string;
}

function extractFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8Match = header.match(/filename\*=UTF-8''([^;\n]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      // Fallback below
    }
  }
  const quotedMatch = header.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const bareMatch = header.match(/filename=([^;\n]+)/i);
  return bareMatch?.[1]?.trim() ?? null;
}

export async function triggerBulkDownload({
  fileIds,
  folderIds,
  archiveName,
}: BulkDownloadInput): Promise<{ mode: "single" | "zip"; filename: string }> {
  // Single file optimization: bypass ZIP archive completely
  if (fileIds.length === 1 && folderIds.length === 0) {
    const a = document.createElement("a");
    a.href = `/api/vault/files/${encodeURIComponent(fileIds[0])}/download`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { mode: "single", filename: "file" };
  }

  const response = await fetch("/api/vault/download/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileIds,
      folderIds,
      ...(archiveName ? { archiveName } : {}),
    }),
  });

  if (!response.ok) {
    let message = `Download failed (${response.status})`;
    try {
      const json = await response.json();
      if (json?.error?.message) {
        message = json.error.message;
      }
    } catch {
      // Ignore non-JSON error body
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const filename =
    extractFilenameFromDisposition(response.headers.get("Content-Disposition")) ||
    `${archiveName || "myvault-export"}.zip`;

  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  }

  return { mode: "zip", filename };
}
