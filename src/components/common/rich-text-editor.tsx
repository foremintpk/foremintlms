"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { useEffect } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function ToolbarButton({
  label,
  active,
  onClick,
  disabled,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Toggle
      size="sm"
      pressed={Boolean(active)}
      onPressedChange={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className="size-8 p-0"
    >
      {children}
    </Toggle>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^(https?:\/\/|mailto:|\/)/i.test(url)) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  const addImage = () => {
    const url = window.prompt("Image URL (https://…)");
    if (url && /^https:\/\//i.test(url)) editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1" role="toolbar" aria-label="Formatting">
      <ToolbarButton label="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Subheading" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="size-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="size-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="size-4" />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton label="Link" active={editor.isActive("link")} onClick={setLink}>
        <Link2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Image" onClick={addImage}>
        <ImageIcon className="size-4" />
      </ToolbarButton>
      <div className="ml-auto flex items-center">
        <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          <Redo2 className="size-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}

/**
 * WYSIWYG editor producing HTML. Output is sanitised again on the server
 * before it is stored and before it is rendered.
 */
export function RichTextEditor({
  value,
  onChange,
  name,
  placeholder = "Start writing…",
  className,
  minHeight = 220,
  ariaLabel = "Rich text editor",
}: {
  value: string;
  onChange?: (html: string) => void;
  /** When set, a hidden input with this name carries the HTML in forms. */
  name?: string;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  ariaLabel?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow" } }),
      Image,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose-foremint max-w-none px-4 py-3 outline-none",
        style: `min-height:${minHeight}px`,
        "aria-label": ariaLabel,
      },
    },
    onUpdate: ({ editor: e }) => onChange?.(e.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-background focus-within:ring-3 focus-within:ring-ring/30", className)}>
      {editor ? <Toolbar editor={editor} /> : <div className="h-10 border-b bg-muted/40" />}
      <EditorContent editor={editor} />
      {name ? <input type="hidden" name={name} value={editor?.getHTML() ?? value} readOnly /> : null}
    </div>
  );
}
