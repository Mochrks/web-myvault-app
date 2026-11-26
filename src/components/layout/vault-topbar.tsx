"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeft, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useVaultLayout } from "@/components/layout/vault-header-context";
import { useVault } from "@/components/vault/vault-provider";
import { cn } from "@/lib/utils/cn";

export function VaultTopbar() {
  const pathname = usePathname();
  const { toggleSidebar, setMobileSidebarOpen, setHeaderSlotEl, hasCustomHeader } =
    useVaultLayout();
  const { isRefreshing, refreshMetadata, setActiveSearchOpen } = useVault();

  let defaultLabel = "Dashboard";
  if (pathname === "/favorites") defaultLabel = "Favorites";
  else if (pathname.startsWith("/files")) defaultLabel = "All Files";
  else if (pathname.startsWith("/notes/")) defaultLabel = "Note Editor";

  return (
    <header className="flex h-13 shrink-0 items-center gap-2.5 border-b border-border bg-background/95 px-3.5 backdrop-blur-sm sm:px-4">
      {/* Mobile Sidebar Drawer Trigger */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setMobileSidebarOpen(true)}
        className="lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Desktop Sidebar Collapse Trigger (Dashboard-01 signature icon) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            className="hidden lg:inline-flex"
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Toggle sidebar (Ctrl+B)</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-4" />

      {/* Portal slot for page-specific single-row header */}
      <div
        ref={setHeaderSlotEl}
        className={cn(
          "flex min-w-0 flex-1 items-center justify-between gap-2.5",
          !hasCustomHeader && "hidden"
        )}
      />

      {/* Fallback default header when a route doesn't mount VaultPageHeader */}
      {!hasCustomHeader && (
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <span className="truncate text-sm font-medium text-foreground">{defaultLabel}</span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveSearchOpen(true)}
              className="hidden h-8 gap-2 text-muted-foreground sm:inline-flex"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">Search</span>
              <kbd className="rounded border border-border bg-secondary px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                Ctrl K
              </kbd>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => refreshMetadata()}
                  disabled={isRefreshing}
                  aria-label="Refresh vault"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Refresh vault</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </header>
  );
}
