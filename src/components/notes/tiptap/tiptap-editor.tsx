"use client";

import * as React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import CharacterCount from "@tiptap/extension-character-count";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { common, createLowlight } from "lowlight";
import { EditorBubbleMenu } from "@/components/notes/tiptap/editor-bubble-menu";
import { EditorToolbar } from "@/components/notes/tiptap/editor-toolbar";
import {
  SLASH_COMMANDS,
  SlashCommandMenu,
  type SlashCommandItem,
} from "@/components/notes/tiptap/slash-command-menu";

const lowlight = createLowlight(common);

export interface TiptapEditorHandle {
  scrollToHeading: (text: string) => void;
}

interface TiptapMarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  onUploadImage?: (file: File) => Promise<string | null>;
  editorRef?: React.Ref<TiptapEditorHandle>;
}

interface SlashState {
  open: boolean;
  query: string;
  range: { from: number; to: number } | null;
  position: { top: number; left: number };
}

export function TiptapMarkdownEditor({
  value,
  onChange,
  onUploadImage,
  editorRef,
}: TiptapMarkdownEditorProps) {
  const lastEmittedRef = React.useRef(value);
  const uploadHandlerRef = React.useRef(onUploadImage);
  React.useEffect(() => {
    uploadHandlerRef.current = onUploadImage;
  }, [onUploadImage]);

  const [slash, setSlash] = React.useState<SlashState>({
    open: false,
    query: "",
    range: null,
    position: { top: 0, left: 0 },
  });
  const [slashIndex, setSlashIndex] = React.useState(0);
  const slashRef = React.useRef(slash);
  const slashIndexRef = React.useRef(slashIndex);

  const filteredSlashItems = React.useMemo(() => {
    const q = slash.query.trim().toLowerCase();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.keywords.some((k) => k.includes(q))
    );
  }, [slash.query]);

  const filteredItemsRef = React.useRef(filteredSlashItems);
  React.useEffect(() => {
    slashRef.current = slash;
    slashIndexRef.current = slashIndex;
    filteredItemsRef.current = filteredSlashItems;
  }, [slash, slashIndex, filteredSlashItems]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: {
          openOnClick: false,
          autolink: true,
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      TableKit.configure({
        table: { resizable: false },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ allowBase64: false }),
      Placeholder.configure({
        placeholder: "Start writing your note, or type '/' for commands...",
      }),
      CharacterCount,
      Markdown.configure({
        markedOptions: {
          gfm: true,
          breaks: false,
        },
      }),
    ],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "vault-tiptap-content focus:outline-none",
      },
      handleKeyDown: (view, event) => {
        const currentSlash = slashRef.current;
        if (!currentSlash.open) return false;
        const items = filteredItemsRef.current;

        if (event.key === "Escape") {
          event.preventDefault();
          setSlash((s) => ({ ...s, open: false }));
          return true;
        }
        if (items.length === 0) return false;

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSlashIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSlashIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          const chosen = items[slashIndexRef.current] ?? items[0];
          if (chosen && currentSlash.range) {
            const { from, to } = currentSlash.range;
            view.dispatch(view.state.tr.delete(from, to));
            // Trigger command on next microtask so editor state reflects deleted slash text
            queueMicrotask(() => {
              if (editorInstanceRef.current) {
                chosen.action(editorInstanceRef.current);
              }
            });
          }
          setSlash((s) => ({ ...s, open: false }));
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        if (!files || files.length === 0) return false;
        const imageFile = Array.from(files).find((f) => f.type.startsWith("image/"));
        if (!imageFile || !uploadHandlerRef.current) return false;
        event.preventDefault();
        void uploadHandlerRef.current(imageFile).then((url) => {
          if (url && editorInstanceRef.current) {
            editorInstanceRef.current
              .chain()
              .focus()
              .setImage({ src: url, alt: imageFile.name })
              .run();
          }
        });
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = ed.getMarkdown();
      lastEmittedRef.current = md;
      onChange(md);
      detectSlashTrigger(ed);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      detectSlashTrigger(ed);
    },
  });

  const editorInstanceRef = React.useRef(editor);
  React.useEffect(() => {
    editorInstanceRef.current = editor;
  }, [editor]);

  const detectSlashTrigger = React.useCallback((ed: NonNullable<typeof editor>) => {
    const { selection } = ed.state;
    if (!selection.empty || ed.isActive("codeBlock")) {
      setSlash((s) => (s.open ? { ...s, open: false } : s));
      return;
    }

    const { $from } = selection;
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
    const match = textBefore.match(/(?:^|\s)\/([a-z0-9]*)$/i);
    if (!match) {
      setSlash((s) => (s.open ? { ...s, open: false } : s));
      return;
    }

    const query = match[1] ?? "";
    const slashLength = query.length + 1; // "/" + query
    const to = selection.from;
    const from = to - slashLength;

    try {
      const coords = ed.view.coordsAtPos(to);
      const top = Math.min(coords.bottom + 8, window.innerHeight - 280);
      const left = Math.min(coords.left, window.innerWidth - 276);
      setSlash({
        open: true,
        query,
        range: { from, to },
        position: { top: Math.max(12, top), left: Math.max(12, left) },
      });
      setSlashIndex(0);
    } catch {
      setSlash((s) => (s.open ? { ...s, open: false } : s));
    }
  }, []);

  // Sync external value changes (e.g. switching back from Source mode)
  React.useEffect(() => {
    if (!editor) return;
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      editor.commands.setContent(value, { contentType: "markdown" });
    }
  }, [editor, value]);

  React.useImperativeHandle(
    editorRef,
    () => ({
      scrollToHeading: (text: string) => {
        if (!editor) return;
        const container = editor.view.dom;
        const headings = container.querySelectorAll("h1, h2, h3");
        for (const node of Array.from(headings)) {
          if (node.textContent?.trim() === text.trim()) {
            node.scrollIntoView({ behavior: "smooth", block: "center" });
            break;
          }
        }
      },
    }),
    [editor]
  );

  const handleSelectSlashItem = (item: SlashCommandItem) => {
    if (!editor) return;
    if (slash.range) {
      editor.chain().focus().deleteRange(slash.range).run();
    }
    item.action(editor);
    setSlash((s) => ({ ...s, open: false }));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <EditorToolbar editor={editor} onUploadImage={onUploadImage} />

      <div className="relative flex-1 overflow-y-auto">
        <div className="vault-tiptap mx-auto w-full max-w-3xl px-4 py-6 sm:px-10 sm:py-8">
          <EditorBubbleMenu editor={editor} />
          <EditorContent editor={editor} />
        </div>
      </div>

      <SlashCommandMenu
        open={slash.open}
        position={slash.position}
        items={filteredSlashItems}
        selectedIndex={slashIndex}
        onSelect={handleSelectSlashItem}
      />
    </div>
  );
}
