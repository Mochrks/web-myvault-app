"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Quote,
  Table as TableIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
  action: (editor: Editor) => void;
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: "h1",
    label: "Heading 1",
    description: "Large section heading",
    keywords: ["h1", "heading", "title"],
    icon: Heading1,
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    label: "Heading 2",
    description: "Medium subsection heading",
    keywords: ["h2", "heading", "subtitle"],
    icon: Heading2,
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    label: "Heading 3",
    description: "Small heading",
    keywords: ["h3", "heading"],
    icon: Heading3,
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: "bullet",
    label: "Bullet List",
    description: "Create an unordered list",
    keywords: ["ul", "list", "bullet"],
    icon: List,
    action: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: "ordered",
    label: "Numbered List",
    description: "Create an ordered list",
    keywords: ["ol", "list", "number"],
    icon: ListOrdered,
    action: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "task",
    label: "Task Checklist",
    description: "Track to-dos with checkboxes",
    keywords: ["todo", "check", "task", "checkbox"],
    icon: CheckSquare,
    action: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    id: "code",
    label: "Code Block",
    description: "Syntax-highlighted code snippet",
    keywords: ["code", "snippet", "pre"],
    icon: Code2,
    action: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "quote",
    label: "Blockquote",
    description: "Capture a quote or callout",
    keywords: ["quote", "blockquote", "callout"],
    icon: Quote,
    action: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "table",
    label: "Table",
    description: "Insert a 3×3 markdown table",
    keywords: ["table", "grid"],
    icon: TableIcon,
    action: (e) =>
      e
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    id: "divider",
    label: "Divider",
    description: "Visual horizontal separator",
    keywords: ["hr", "divider", "line", "separator"],
    icon: Minus,
    action: (e) => e.chain().focus().setHorizontalRule().run(),
  },
];

export function SlashCommandMenu({
  open,
  position,
  items,
  selectedIndex,
  onSelect,
}: {
  open: boolean;
  position: { top: number; left: number };
  items: SlashCommandItem[];
  selectedIndex: number;
  onSelect: (item: SlashCommandItem) => void;
}) {
  if (!open || items.length === 0) return null;

  return (
    <div
      style={{ top: position.top, left: position.left }}
      className="fixed z-50 w-64 overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-2xl"
      role="listbox"
      aria-label="Insert block"
    >
      <div className="px-2 py-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        Insert Block
      </div>
      <div className="max-h-64 overflow-y-auto space-y-0.5">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const active = idx === selectedIndex;
          return (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors cursor-pointer",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/90 hover:bg-accent/60"
              )}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{item.label}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {item.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
