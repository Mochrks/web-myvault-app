export type FileKind =
  | "code"
  | "note"
  | "text"
  | "image"
  | "spreadsheet"
  | "document"
  | "pdf"
  | "archive"
  | "other";

export interface VaultFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VaultFile {
  id: string;
  name: string;
  folderId: string | null;
  objectKey: string;
  mimeType: string;
  extension: string;
  size: number;
  kind: FileKind;
  createdAt: string;
  updatedAt: string;
}

export interface VaultMetadataIndex {
  schemaVersion: 1;
  revision: number;
  updatedAt: string;
  folders: VaultFolder[];
  files: VaultFile[];
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export type ApiResponse<T> =
  | {
      success: true;
      data: T;
      error: null;
    }
  | {
      success: false;
      data: null;
      error: ApiErrorPayload;
    };

export interface VaultStats {
  totalFolders: number;
  totalFiles: number;
  totalBytes: number;
  recentFiles: VaultFile[];
}
