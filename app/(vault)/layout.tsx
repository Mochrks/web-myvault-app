import * as React from "react";
import { VaultShell } from "@/components/layout/vault-shell";
import { VaultProvider } from "@/components/vault/vault-provider";
import { VaultAppError } from "@/lib/api/response";
import { requirePageSession } from "@/lib/auth/require-session";
import { VaultService } from "@/lib/metadata/vault-service";
import { isBlobStorageConfigured } from "@/lib/storage/blob-storage";
import type { VaultMetadataIndex } from "@/types/vault";

export const dynamic = "force-dynamic";

function parseMaxUploadSizeMb(): number {
  const raw = Number(process.env.MAX_UPLOAD_SIZE_MB ?? "100");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 100;
}

const EMPTY_METADATA: VaultMetadataIndex = {
  schemaVersion: 1,
  revision: 0,
  updatedAt: "1970-01-01T00:00:00.000Z",
  folders: [],
  files: [],
};

export default async function VaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageSession();

  let metadata: VaultMetadataIndex = EMPTY_METADATA;
  let storageConfigured = isBlobStorageConfigured();
  let storageError: string | null = null;

  if (storageConfigured) {
    try {
      const vault = new VaultService();
      metadata = await vault.getMetadata();
    } catch (err) {
      if (err instanceof VaultAppError && err.code === "STORAGE_NOT_CONFIGURED") {
        storageConfigured = false;
      } else {
        storageError =
          err instanceof Error
            ? err.message
            : "Failed to read metadata from private object storage.";
      }
    }
  }

  const maxUploadSizeMb = parseMaxUploadSizeMb();

  return (
    <VaultProvider
      initialMetadata={metadata}
      maxUploadSizeMb={maxUploadSizeMb}
      storageConfigured={storageConfigured}
      initialStorageError={storageError}
    >
      <VaultShell>{children}</VaultShell>
    </VaultProvider>
  );
}
