"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from "react-resizable-panels";
import { cn } from "@/lib/utils/cn";

export function ResizablePanelGroup({ className, ...props }: GroupProps) {
  return (
    <Group
      className={cn("flex h-full w-full", className)}
      {...props}
    />
  );
}

export function ResizablePanel({ className, ...props }: PanelProps) {
  return <Panel className={cn("min-w-0", className)} {...props} />;
}

export function ResizableHandle({
  withHandle = false,
  className,
  ...props
}: SeparatorProps & { withHandle?: boolean }) {
  return (
    <Separator
      className={cn(
        "group relative flex w-px shrink-0 items-center justify-center bg-border transition-colors hover:bg-neutral-500 focus-visible:outline-none data-[separator=active]:bg-foreground/70",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-6 w-3 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          <GripVertical className="h-2.5 w-2.5" />
        </div>
      )}
    </Separator>
  );
}
