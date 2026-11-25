"use client";

import * as React from "react";
import { AlertTriangle, X } from "lucide-react";
import { VaultSidebar } from "@/components/layout/vault-sidebar";
import { VaultTopbar } from "@/components/layout/vault-topbar";
import { VaultGlobalDialogs } from "@/components/vault/vault-dialogs";
import { FilePreviewModal } from "@/components/code-viewer/code-preview-modal";
import { useVault } from "@/components/vault/vault-provider";

export function VaultShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [warningDismissed, setWarningDismissed] = React.useState(false);
  const { previewFile, setPreviewFile, storageConfigured } = useVault();

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <VaultSidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <VaultTopbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          {!storageConfigured && !warningDismissed && (
            <div
              role="alert"
              className="mx-4 mt-4 flex items-start justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 sm:mx-6"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-amber-100">
                    Vercel Blob storage is not configured
                  </p>
                  <p className="text-amber-200/80">
                    <code className="rounded bg-amber-500/20 px-1 py-0.5 font-mono text-[11px]">
                      BLOB_READ_WRITE_TOKEN
                    </code>{" "}
                    is not set. You can explore the UI, but creating folders,
                    saving notes, and uploading files require a Private Vercel
                    Blob token in{" "}
                    <code className="rounded bg-amber-500/20 px-1 py-0.5 font-mono text-[11px]">
                      .env.local
                    </code>{" "}
                    or your Vercel project settings.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWarningDismissed(true)}
                className="rounded p-1 text-amber-300/80 hover:bg-amber-500/20 hover:text-amber-100"
                aria-label="Dismiss warning"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {children}
        </main>
      </div>

      <VaultGlobalDialogs />
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
