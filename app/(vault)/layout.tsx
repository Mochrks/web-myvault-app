import * as React from "react";
import { VaultShell } from "@/components/layout/vault-shell";
import { VaultProvider } from "@/components/vault/vault-provider";
import { requirePageSession } from "@/lib/auth/require-session";
import { VaultService } from "@/lib/metadata/vault-service";

export const dynamic = "force-dynamic";

function parseMaxUploadSizeMb(): number {
  const raw = Number(process.env.MAX_UPLOAD_SIZE_MB ?? "100");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 100;
}

export default async function VaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageSession();

  const vault = new VaultService();
  const metadata = await vault.getMetadata();
  const maxUploadSizeMb = parseMaxUploadSizeMb();

  return (
    <VaultProvider
      initialMetadata={metadata}
      maxUploadSizeMb={maxUploadSizeMb}
    >
      <VaultShell>{children}</VaultShell>
    </VaultProvider>
  );
}
