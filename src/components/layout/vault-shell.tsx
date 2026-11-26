"use client";

import * as React from "react";
import { AlertTriangle, X } from "lucide-react";
import { VaultLayoutProvider } from "@/components/layout/vault-header-context";
import { VaultSidebar } from "@/components/layout/vault-sidebar";
import { VaultTopbar } from "@/components/layout/vault-topbar";
import { VaultGlobalDialogs } from "@/components/vault/vault-dialogs";
import { FilePreviewModal } from "@/components/code-viewer/code-preview-modal";
import { useVault } from "@/components/vault/vault-provider";

function VaultShellInner({ children }: { children: React.ReactNode }) {
  const [warningDismissed, setWarningDismissed] = React.useState(false);
  const {
    previewFile,
    setPreviewFile,
    storageConfigured,
    storageError,
    refreshMetadata,
    isRefreshing,
  } = useVault();

  return (
    <div className="flex h-screen overflow-hidden bg-sidebar text-foreground">
      <VaultSidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background lg:my-2 lg:mr-2 lg:rounded-xl lg:border lg:border-border shadow-xs">
        <VaultTopbar />

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {(!storageConfigured || storageError) && !warningDismissed && (
            <div
              role="alert"
              className="mx-4 mt-4 flex items-start justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 sm:mx-6"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-100">
                    {!storageConfigured
                      ? "Vercel Blob storage is not configured"
                      : "Could not sync vault metadata from storage"}
                  </p>
                  <p className="text-amber-200/80">
                    {!storageConfigured ? (
                      <>
                        <code className="rounded bg-amber-500/15 px-1 py-0.5 font-mono text-[11px]">
                          BLOB_READ_WRITE_TOKEN
                        </code>{" "}
                        is not set. You can explore the UI, but creating folders, saving notes, and
                        uploading files require a Private Vercel Blob token in{" "}
                        <code className="rounded bg-amber-500/15 px-1 py-0.5 font-mono text-[11px]">
                          .env.local
                        </code>{" "}
                        or your Vercel project settings.
                      </>
                    ) : (
                      <>
                        {storageError}{" "}
                        <button
                          type="button"
                          onClick={() => refreshMetadata()}
                          disabled={isRefreshing}
                          className="ml-1 underline hover:text-amber-100 disabled:opacity-50"
                        >
                          {isRefreshing ? "Retrying..." : "Retry now"}
                        </button>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWarningDismissed(true)}
                className="rounded p-1 text-amber-300/80 hover:bg-amber-500/20 hover:text-amber-100 cursor-pointer"
                aria-label="Dismiss warning"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </main>
      </div>

      <VaultGlobalDialogs />
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}

export function VaultShell({ children }: { children: React.ReactNode }) {
  return (
    <VaultLayoutProvider>
      <VaultShellInner>{children}</VaultShellInner>
    </VaultLayoutProvider>
  );
}
