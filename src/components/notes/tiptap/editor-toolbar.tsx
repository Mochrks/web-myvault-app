"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  ChevronDown,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline,
  Undo2,
  Unlink,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EditorToolbarProps {
  editor: Editor | null;
  onUploadImage?: (file: File) => Promise<string | null>;
}

const CODE_LANGUAGES = [
  { label: "Plain text", value: "" },
  { label: "TypeScript", value: "typescript" },
  { label: "JavaScript", value: "javascript" },
  { label: "Python", value: "python" },
  { label: "Go", value: "go" },
  { label: "Rust", value: "rust" },
  { label: "SQL", value: "sql" },
  { label: "Bash / Shell", value: "bash" },
  { label: "JSON", value: "json" },
  { label: "HTML / XML", value: "xml" },
  { label: "CSS", value: "css" },
  { label: "YAML", value: "yaml" },
];

function ToolbarButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          size="sm"
          pressed={Boolean(pressed)}
          disabled={disabled}
          onPressedChange={() => onClick()}
          aria-label={label}
        >
          {children}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function EditorToolbar({ editor, onUploadImage }: EditorToolbarProps) {
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");
  const [imageOpen, setImageOpen] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState("");
  const [imageAlt, setImageAlt] = React.useState("");
  const [uploadingImg, setUploadingImg] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const currentBlockLabel = editor.isActive("heading", { level: 1 })
    ? "Heading 1"
    : editor.isActive("heading", { level: 2 })
      ? "Heading 2"
      : editor.isActive("heading", { level: 3 })
        ? "Heading 3"
        : editor.isActive("codeBlock")
          ? "Code Block"
          : editor.isActive("blockquote")
            ? "Quote"
            : "Paragraph";

  const isInTable = editor.isActive("table");
  const isInCodeBlock = editor.isActive("codeBlock");
  const currentCodeLang = isInCodeBlock
    ? (editor.getAttributes("codeBlock").language as string) || ""
    : "";

  const openLinkPopover = () => {
    const existing = (editor.getAttributes("link").href as string) || "";
    setLinkUrl(existing);
    setLinkOpen(true);
  };

  const applyLink = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const safeHref = /^https?:\/\/|^mailto:|^\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: safeHref })
        .run();
    }
    setLinkOpen(false);
  };

  const insertImageByUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const src = imageUrl.trim();
    if (!src) return;
    editor
      .chain()
      .focus()
      .setImage({ src, alt: imageAlt.trim() || "image" })
      .run();
    setImageUrl("");
    setImageAlt("");
    setImageOpen(false);
  };

  const handleImageFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUploadImage) return;
    setUploadingImg(true);
    try {
      const uploadedSrc = await onUploadImage(file);
      if (uploadedSrc) {
        editor
          .chain()
          .focus()
          .setImage({ src: uploadedSrc, alt: file.name })
          .run();
        setImageOpen(false);
      }
    } finally {
      setUploadingImg(false);
    }
  };

  return (
    <div className="flex flex-nowrap items-center gap-0.5 overflow-x-auto border-b border-border bg-card/70 px-3 py-1.5 backdrop-blur-sm sm:flex-wrap sm:overflow-visible">
      {/* History */}
      <ToolbarButton
        label="Undo (Ctrl+Z)"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton
        label="Redo (Ctrl+Y)"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-4" />

      {/* Block Style Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-7 gap-1 px-2 text-xs font-medium text-foreground"
          >
            <span>{currentBlockLabel}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().setParagraph().run()}
          >
            <Pilcrow className="h-3.5 w-3.5" />
            Paragraph
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            <Heading1 className="h-3.5 w-3.5" />
            Heading 1
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 className="h-3.5 w-3.5" />
            Heading 2
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3 className="h-3.5 w-3.5" />
            Heading 3
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="h-3.5 w-3.5" />
            Blockquote
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <Code2 className="h-3.5 w-3.5" />
            Code Block
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Code Block Language Selector (contextual) */}
      {isInCodeBlock && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              className="h-7 gap-1 px-2 font-mono text-[11px]"
            >
              <span>{currentCodeLang || "plain"}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto w-40">
            <DropdownMenuLabel>Code Language</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CODE_LANGUAGES.map((lang) => (
              <DropdownMenuItem
                key={lang.value || "plain"}
                onSelect={() =>
                  editor
                    .chain()
                    .focus()
                    .updateAttributes("codeBlock", { language: lang.value })
                    .run()
                }
              >
                {lang.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Separator orientation="vertical" className="mx-1 h-4" />

      {/* Inline Marks */}
      <ToolbarButton
        label="Bold (Ctrl+B)"
        pressed={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold />
      </ToolbarButton>
      <ToolbarButton
        label="Italic (Ctrl+I)"
        pressed={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </ToolbarButton>
      <ToolbarButton
        label="Underline (Ctrl+U)"
        pressed={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        pressed={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough />
      </ToolbarButton>
      <ToolbarButton
        label="Inline Code"
        pressed={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code />
      </ToolbarButton>
      <ToolbarButton
        label="Highlight"
        pressed={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        <Highlighter />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-4" />

      {/* Lists */}
      <ToolbarButton
        label="Bullet List"
        pressed={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered List"
        pressed={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolbarButton>
      <ToolbarButton
        label="Task Checklist"
        pressed={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <CheckSquare />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-4 hidden sm:block" />

      {/* Alignment */}
      <div className="hidden items-center gap-0.5 sm:flex">
        <ToolbarButton
          label="Align Left"
          pressed={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft />
        </ToolbarButton>
        <ToolbarButton
          label="Align Center"
          pressed={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter />
        </ToolbarButton>
        <ToolbarButton
          label="Align Right"
          pressed={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight />
        </ToolbarButton>
      </div>

      <Separator orientation="vertical" className="mx-1 h-4" />

      {/* Link Popover */}
      <Popover open={linkOpen} onOpenChange={setLinkOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Toggle
                size="sm"
                pressed={editor.isActive("link")}
                onClick={openLinkPopover}
                aria-label="Insert or edit link"
              >
                <Link2 />
              </Toggle>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Insert link</TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-72">
          <form onSubmit={applyLink} className="space-y-2.5">
            <p className="text-xs font-medium text-foreground">Link URL</p>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="h-8 text-xs"
              autoFocus
            />
            <div className="flex items-center justify-between gap-2">
              {editor.isActive("link") ? (
                <Button
                  type="button"
                  variant="destructive-ghost"
                  size="xs"
                  onClick={() => {
                    editor.chain().focus().unsetLink().run();
                    setLinkOpen(false);
                  }}
                >
                  <Unlink className="h-3 w-3" />
                  Remove
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" size="xs">
                Apply
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>

      {/* Image Popover (Vault Upload + URL) */}
      <Popover open={imageOpen} onOpenChange={setImageOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Toggle size="sm" pressed={false} aria-label="Insert image">
                <ImagePlus />
              </Toggle>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Insert or upload image</TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-76 space-y-3">
          {onUploadImage && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">
                Upload to Vault
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={uploadingImg}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingImg ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    Choose image file
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleImageFileChange}
              />
              <Separator />
            </div>
          )}

          <form onSubmit={insertImageByUrl} className="space-y-2">
            <p className="text-xs font-medium text-foreground">Image URL</p>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="/api/vault/files/... or https://..."
              className="h-8 text-xs"
            />
            <Input
              value={imageAlt}
              onChange={(e) => setImageAlt(e.target.value)}
              placeholder="Alt text (optional)"
              className="h-8 text-xs"
            />
            <div className="flex justify-end">
              <Button type="submit" size="xs" disabled={!imageUrl.trim()}>
                Insert Image
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>

      {/* Table Dropdown */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Toggle size="sm" pressed={isInTable} aria-label="Table controls">
                <TableIcon />
              </Toggle>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Table</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem
            onSelect={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          >
            Insert 3×3 Table
          </DropdownMenuItem>
          {isInTable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().addColumnAfter().run()}
              >
                Add Column After
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().addRowAfter().run()}
              >
                Add Row After
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().deleteColumn().run()}
              >
                Delete Column
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().deleteRow().run()}
              >
                Delete Row
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onSelect={() => editor.chain().focus().deleteTable().run()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Table
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Horizontal Rule */}
      <ToolbarButton
        label="Horizontal Divider"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus />
      </ToolbarButton>
    </div>
  );
}
