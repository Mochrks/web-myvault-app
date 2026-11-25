"use client";

import * as React from "react";
import { VaultSidebar } from "@/components/layout/vault-sidebar";
import { VaultTopbar } from "@/components/layout/vault-topbar";
import { VaultGlobalDialogs } from "@/components/vault/vault-dialogs";
import { FilePreviewModal } from "@/components/code-viewer/code-preview-modal";
import { useVault } from "@/components/vault/vault-provider";

export function VaultShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { previewFile, setPreviewFile } = useVault();

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <VaultSidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <VaultTopbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      <VaultGlobalDialogs />
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
