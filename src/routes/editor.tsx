import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { useRef, useState } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Quote,
  Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight, Code, Undo, Redo,
  Download, Upload, FileText,
} from "lucide-react";
import { Document as DocxDoc, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";

export const Route = createFileRoute("/editor")({
  component: DocEditor,
  head: () => ({ meta: [{ title: "Document Editor — Loomdocs" }, { name: "description", content: "Rich text editor with .docx import and export. Write and edit documents in your browser." }] }),
});

function DocEditor() {
  const [filename, setFilename] = useState("document");
  const inputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Image,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: `<h1>Untitled document</h1><p>Start writing… or import a <strong>.docx</strong> file from the toolbar above.</p>`,
    immediatelyRender: false,
  });

  async function importDocx(file: File) {
    setFilename(file.name.replace(/\.docx?$/i, ""));
    const mammoth = await import("mammoth");
    const buf = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buf });
    editor?.commands.setContent(result.value);
  }

  async function exportDocx() {
    if (!editor) return;
    const html = editor.getHTML();
    const blocks = htmlToDocxBlocks(html);
    const doc = new DocxDoc({ sections: [{ children: blocks }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${filename || "document"}.docx`);
  }

  function exportHtml() {
    if (!editor) return;
    const html = `<!doctype html><meta charset="utf-8"><title>${filename}</title>${editor.getHTML()}`;
    saveAs(new Blob([html], { type: "text/html" }), `${filename || "document"}.html`);
  }

  if (!editor) return <AppLayout><div /></AppLayout>;

  return (
    <AppLayout>
      <div className="flex flex-col h-screen">
        <div className="border-b border-border bg-surface px-5 py-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="bg-transparent border-none outline-none font-display font-medium text-base w-64"
          />
          <div className="ml-auto flex items-center gap-2">
            <input ref={inputRef} type="file" accept=".docx" className="hidden" onChange={(e) => e.target.files?.[0] && importDocx(e.target.files[0])} />
            <button onClick={() => inputRef.current?.click()} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-surface-elevated flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Import .docx</button>
            <button onClick={exportHtml} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-surface-elevated">HTML</button>
            <button onClick={exportDocx} className="px-4 py-1.5 text-sm font-medium rounded-lg bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Export .docx</button>
          </div>
        </div>

        <div className="border-b border-border bg-surface/50 px-3 py-2 flex flex-wrap items-center gap-1">
          <Tb on={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} icon={Bold} />
          <Tb on={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} icon={Italic} />
          <Tb on={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} icon={UnderlineIcon} />
          <Tb on={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} icon={Strikethrough} />
          <Sep />
          <Tb on={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} icon={Heading1} />
          <Tb on={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} icon={Heading2} />
          <Tb on={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} icon={Heading3} />
          <Sep />
          <Tb on={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} icon={List} />
          <Tb on={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} icon={ListOrdered} />
          <Tb on={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} icon={Quote} />
          <Tb on={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} icon={Code} />
          <Sep />
          <Tb on={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} icon={AlignLeft} />
          <Tb on={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} icon={AlignCenter} />
          <Tb on={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} icon={AlignRight} />
          <Sep />
          <Tb on={false} onClick={() => editor.chain().focus().undo().run()} icon={Undo} />
          <Tb on={false} onClick={() => editor.chain().focus().redo().run()} icon={Redo} />
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin bg-background py-10">
          <div className="max-w-3xl mx-auto bg-card border border-border rounded-xl shadow-elevated min-h-[80vh] p-12">
            <EditorContent editor={editor} className="tiptap" />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Tb({ on, onClick, icon: Icon }: { on: boolean; onClick: () => void; icon: any }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 w-8 rounded-md flex items-center justify-center transition ${
        on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
function Sep() {
  return <div className="h-5 w-px bg-border mx-1" />;
}

// Lightweight HTML → docx Paragraph[] (covers headings, paragraphs, lists, basic formatting)
function htmlToDocxBlocks(html: string): Paragraph[] {
  if (typeof window === "undefined") return [];
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild as HTMLElement;
  const blocks: Paragraph[] = [];

  const inlineRuns = (el: Node, inherit: { bold?: boolean; italics?: boolean; underline?: boolean; strike?: boolean } = {}): TextRun[] => {
    const runs: TextRun[] = [];
    el.childNodes.forEach((c) => {
      if (c.nodeType === 3) {
        const t = c.textContent ?? "";
        if (t) runs.push(new TextRun({ text: t, ...inherit, underline: inherit.underline ? {} : undefined }));
      } else if (c.nodeType === 1) {
        const e = c as HTMLElement;
        const tag = e.tagName.toLowerCase();
        const next = { ...inherit };
        if (tag === "strong" || tag === "b") next.bold = true;
        if (tag === "em" || tag === "i") next.italics = true;
        if (tag === "u") next.underline = true;
        if (tag === "s" || tag === "strike" || tag === "del") next.strike = true;
        if (tag === "br") {
          runs.push(new TextRun({ text: "", break: 1 }));
          return;
        }
        runs.push(...inlineRuns(e, next));
      }
    });
    return runs;
  };

  const align = (el: HTMLElement) => {
    const a = el.style.textAlign;
    if (a === "center") return AlignmentType.CENTER;
    if (a === "right") return AlignmentType.RIGHT;
    if (a === "justify") return AlignmentType.JUSTIFIED;
    return undefined;
  };

  const walk = (el: HTMLElement) => {
    Array.from(el.children).forEach((c) => {
      const e = c as HTMLElement;
      const tag = e.tagName.toLowerCase();
      if (tag === "h1") blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: inlineRuns(e), alignment: align(e) }));
      else if (tag === "h2") blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: inlineRuns(e), alignment: align(e) }));
      else if (tag === "h3") blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: inlineRuns(e), alignment: align(e) }));
      else if (tag === "p") blocks.push(new Paragraph({ children: inlineRuns(e), alignment: align(e) }));
      else if (tag === "blockquote") blocks.push(new Paragraph({ children: inlineRuns(e), indent: { left: 720 } }));
      else if (tag === "ul" || tag === "ol") {
        Array.from(e.children).forEach((li) => {
          blocks.push(new Paragraph({ children: inlineRuns(li as HTMLElement), bullet: tag === "ul" ? { level: 0 } : undefined, numbering: tag === "ol" ? { reference: "ord", level: 0 } : undefined as any }));
        });
      } else if (tag === "pre") {
        blocks.push(new Paragraph({ children: [new TextRun({ text: e.textContent ?? "", font: "Courier New" })] }));
      } else {
        // fallback
        const runs = inlineRuns(e);
        if (runs.length) blocks.push(new Paragraph({ children: runs }));
        else walk(e);
      }
    });
  };
  walk(root);
  return blocks.length ? blocks : [new Paragraph("")];
}
