"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckSquare, Download, Loader2, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface BulkActionBarProps {
  selectedCount: number;
  isSingleFileOnly: boolean;
  allSelected: boolean;
  downloading: boolean;
  starring: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onDownload: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

export function BulkActionBar({
  selectedCount,
  isSingleFileOnly,
  allSelected,
  downloading,
  starring,
  onSelectAll,
  onClear,
  onDownload,
  onToggleFavorite,
  onDelete,
}: BulkActionBarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-fit -translate-x-1/2 sm:bottom-5"
        >
          <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-border bg-popover/95 px-2.5 py-2 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2 pl-1.5 pr-1">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1.5 font-mono text-[11px] font-semibold tabular-nums text-primary-foreground">
                {selectedCount}
              </span>
              <span className="text-xs font-medium text-foreground">
                selected
              </span>
            </div>

            {!allSelected && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onSelectAll}
                className="text-muted-foreground hover:text-foreground"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Select all
              </Button>
            )}

            <Separator orientation="vertical" className="mx-0.5 h-5" />

            <Button
              type="button"
              size="xs"
              onClick={onDownload}
              disabled={downloading}
              className="h-7 rounded-lg px-2.5 font-medium"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Zipping...
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  {isSingleFileOnly ? "Download" : "Download ZIP"}
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onToggleFavorite}
              disabled={starring}
            >
              {starring ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Star className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Star</span>
            </Button>

            <Button
              type="button"
              variant="destructive-ghost"
              size="xs"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </Button>

            <Separator orientation="vertical" className="mx-0.5 h-5" />

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClear}
              aria-label="Clear selection"
              title="Clear selection (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
