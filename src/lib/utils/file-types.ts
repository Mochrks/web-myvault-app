import type { FileKind } from "@/types/vault";

const CODE_EXTENSIONS = new Set([
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "mts",
  "cts",
  "tsx",
  "go",
  "py",
  "java",
  "cs",
  "php",
  "rb",
  "rs",
  "c",
  "h",
  "cpp",
  "hpp",
  "cc",
  "sql",
  "sh",
  "bash",
  "zsh",
  "ps1",
  "html",
  "htm",
  "css",
  "scss",
  "sass",
  "less",
  "json",
  "jsonc",
  "xml",
  "yaml",
  "yml",
  "toml",
  "ini",
  "conf",
  "dockerfile",
  "makefile",
  "vue",
  "svelte",
  "kt",
  "swift",
  "dart",
  "r",
  "lua",
  "graphql",
  "prisma",
  "env",
]);

const NOTE_EXTENSIONS = new Set(["md", "markdown", "txt"]);
const TEXT_EXTENSIONS = new Set(["log", "env.example", "gitignore", "editorconfig"]);
const SPREADSHEET_EXTENSIONS = new Set(["xlsx", "xls", "csv", "ods"]);
const DOCUMENT_EXTENSIONS = new Set(["docx", "doc", "pptx", "ppt", "odt", "rtf"]);
const PDF_EXTENSIONS = new Set(["pdf"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "ico", "avif", "svg"]);

/**
 * Extracts normalized lowercase extension from filename.
 * Handles dotfiles such as `.env.example` or `Dockerfile`.
 */
export function extractExtension(filename: string): string {
  const trimmed = filename.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile") return "makefile";
  if (lower.endsWith(".env.example")) return "example";

  const lastDot = lower.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === lower.length - 1) {
    return "";
  }
  return lower.slice(lastDot + 1);
}

/**
 * Classifies a file primarily by extension, using MIME type only as a secondary signal.
 */
export function detectFileKind(filename: string, mimeType?: string): FileKind {
  const ext = extractExtension(filename);
  const lowerName = filename.trim().toLowerCase();

  if (NOTE_EXTENSIONS.has(ext)) return "note";
  if (CODE_EXTENSIONS.has(ext)) return "code";
  if (SPREADSHEET_EXTENSIONS.has(ext)) return "spreadsheet";
  if (DOCUMENT_EXTENSIONS.has(ext)) return "document";
  if (PDF_EXTENSIONS.has(ext)) return "pdf";
  if (ARCHIVE_EXTENSIONS.has(ext)) return "archive";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (TEXT_EXTENSIONS.has(ext) || lowerName === ".env.example" || lowerName === ".gitignore") {
    return "text";
  }

  const normalizedMime = (mimeType ?? "").toLowerCase().split(";")[0].trim();
  if (normalizedMime === "application/pdf") return "pdf";
  if (normalizedMime.startsWith("image/")) return "image";
  if (normalizedMime === "text/markdown") return "note";
  if (normalizedMime === "text/csv") return "spreadsheet";
  if (
    normalizedMime.startsWith("text/") ||
    normalizedMime === "application/json" ||
    normalizedMime === "application/xml" ||
    normalizedMime === "application/javascript"
  ) {
    return "text";
  }

  return "other";
}

export function normalizeMimeType(filename: string, providedMime?: string): string {
  const clean = (providedMime ?? "").trim().toLowerCase().split(";")[0];
  if (clean && clean !== "application/octet-stream") {
    return clean;
  }

  const ext = extractExtension(filename);
  const map: Record<string, string> = {
    md: "text/markdown",
    markdown: "text/markdown",
    txt: "text/plain",
    log: "text/plain",
    csv: "text/csv",
    json: "application/json",
    xml: "application/xml",
    yaml: "application/yaml",
    yml: "application/yaml",
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "text/javascript",
    ts: "text/typescript",
    tsx: "text/typescript",
    jsx: "text/javascript",
    go: "text/plain",
    py: "text/x-python",
    sql: "application/sql",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    zip: "application/zip",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
  };
  return map[ext] ?? "application/octet-stream";
}

const SHIKI_LANG_MAP: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  go: "go",
  py: "python",
  java: "java",
  cs: "csharp",
  php: "php",
  rb: "ruby",
  rs: "rust",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cc: "cpp",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "powershell",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  json: "json",
  jsonc: "jsonc",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  ini: "ini",
  md: "markdown",
  markdown: "markdown",
  csv: "csv",
  dockerfile: "dockerfile",
  vue: "vue",
  svelte: "svelte",
  kt: "kotlin",
  swift: "swift",
  dart: "dart",
  r: "r",
  lua: "lua",
  graphql: "graphql",
  prisma: "prisma",
};

export function getShikiLanguage(filename: string): string {
  const ext = extractExtension(filename);
  return SHIKI_LANG_MAP[ext] ?? "plaintext";
}

/**
 * Checks whether a file is safe & supported for text/code preview.
 * SVG is treated as code/text preview rather than live image DOM rendering to prevent XSS.
 */
export function isTextReadableFile(kind: FileKind, extension: string): boolean {
  if (kind === "code" || kind === "note" || kind === "text") return true;
  if (extension === "csv" || extension === "svg") return true;
  return false;
}

/**
 * Raster images safe to render in `<img>` (never inline-render SVG as trusted HTML/img).
 */
export function isSafeRasterImage(extension: string): boolean {
  return ["png", "jpg", "jpeg", "webp", "gif", "bmp", "ico", "avif"].includes(
    extension.toLowerCase()
  );
}

export function isUnsafeActiveContent(extension: string, mimeType: string): boolean {
  const ext = extension.toLowerCase();
  const mime = mimeType.toLowerCase();
  return (
    ext === "html" ||
    ext === "htm" ||
    ext === "svg" ||
    mime.includes("text/html") ||
    mime.includes("image/svg+xml")
  );
}
