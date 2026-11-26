"use client";

import * as React from "react";
import { ListTree, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export interface OutlineHeading {
  id: string;
  level: number;
  text: string;
}

export function extractMarkdownHeadings(markdown: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  const lines = markdown.split(/\r?\n/);
  let inCodeFence = false;

  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      return;
    }
    if (inCodeFence) return;

    const match = line.match(/^(#{1,3})\s+(.+?)\s*#*$/);
    if (match) {
      headings.push({
        id: `heading-${index}`,
        level: match[1].length,
        text: match[2].replace(/[*_`~]/g, "").trim(),
      });
    }
  });

  return headings;
}

export function DocumentOutline({
  markdown,
  onSelectHeading,
  onClose,
}: {
  markdown: string;
  onSelectHeading: (text: string, level: number) => void;
  onClose: () => void;
}) {
  const headings = React.useMemo(
    () => extractMarkdownHeadings(markdown),
    [markdown]
  );

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-l border-border bg-card/35">
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <ListTree className="h-3.5 w-3.5 text-muted-foreground" />
          Outline
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close outline"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5">
        {headings.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            Add headings (#, ##, ###) to generate a table of contents.
          </p>
        ) : (
          <nav className="space-y-0.5">
            {headings.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => onSelectHeading(h.text, h.level)}
                className={cn(
                  "block w-full truncate rounded-md px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer",
                  h.level === 1 && "font-medium text-foreground/90",
                  h.level === 2 && "pl-4",
                  h.level === 3 && "pl-6 text-[11px]"
                )}
                title={h.text}
              >
                {h.text}
              </button>
            ))}
          </nav>
        )}
      </div>
    </aside>
  );
}
