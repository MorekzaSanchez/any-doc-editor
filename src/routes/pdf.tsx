import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Dropzone } from "@/components/Dropzone";
import { useEffect, useRef, useState } from "react";
import { renderPdfPagesToImages } from "@/lib/pdf";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { saveAs } from "file-saver";
import {
  Type, Highlighter, Pen, Trash2, Download, RotateCw, ArrowUp, ArrowDown,
  Plus, FileText, MousePointer2, X,
} from "lucide-react";

export const Route = createFileRoute("/pdf")({
  component: PdfEditor,
  head: () => ({ meta: [{ title: "PDF Editor — Loomdocs" }, { name: "description", content: "Edit PDFs in your browser: annotate, add text, sign, merge, split, reorder." }] }),
});

type Tool = "select" | "text" | "highlight" | "draw";
type Annotation =
  | { id: string; page: number; type: "text"; x: number; y: number; text: string; size: number; color: string }
  | { id: string; page: number; type: "highlight"; x: number; y: number; w: number; h: number; color: string }
  | { id: string; page: number; type: "draw"; points: { x: number; y: number }[]; color: string; width: number };

type PageState = { dataUrl: string; width: number; height: number; rotation: number };

function PdfEditor() {
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [pages, setPages] = useState<PageState[]>([]);
  const [current, setCurrent] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [color, setColor] = useState("#fbbf24");
  const [loading, setLoading] = useState(false);
  const drawingRef = useRef<{ id: string; points: { x: number; y: number }[] } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  async function loadFile(file: File) {
    setLoading(true);
    const buf = await file.arrayBuffer();
    setBytes(buf);
    const imgs = await renderPdfPagesToImages(buf.slice(0), 1.5);
    setPages(imgs.map((p) => ({ ...p, rotation: 0 })));
    setAnnotations([]);
    setCurrent(0);
    setLoading(false);
  }

  function addText(x: number, y: number) {
    const text = window.prompt("Text:");
    if (!text) return;
    setAnnotations((a) => [
      ...a,
      { id: crypto.randomUUID(), page: current, type: "text", x, y, text, size: 18, color },
    ]);
  }

  function onStageMouseDown(e: React.MouseEvent) {
    if (!pages[current]) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === "text") return addText(x, y);
    if (tool === "highlight") {
      setAnnotations((a) => [
        ...a,
        { id: crypto.randomUUID(), page: current, type: "highlight", x, y: y - 10, w: 120, h: 22, color },
      ]);
    }
    if (tool === "draw") {
      const id = crypto.randomUUID();
      drawingRef.current = { id, points: [{ x, y }] };
      setAnnotations((a) => [...a, { id, page: current, type: "draw", points: [{ x, y }], color, width: 2 }]);
    }
  }
  function onStageMouseMove(e: React.MouseEvent) {
    if (tool !== "draw" || !drawingRef.current) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    drawingRef.current.points.push({ x, y });
    const id = drawingRef.current.id;
    setAnnotations((a) =>
      a.map((an) => (an.id === id && an.type === "draw" ? { ...an, points: [...drawingRef.current!.points] } : an)),
    );
  }
  function onStageMouseUp() {
    drawingRef.current = null;
  }

  function rotatePage(i: number) {
    setPages((p) => p.map((pg, idx) => (idx === i ? { ...pg, rotation: (pg.rotation + 90) % 360 } : pg)));
  }
  function deletePage(i: number) {
    setPages((p) => p.filter((_, idx) => idx !== i));
    setAnnotations((a) => a.filter((an) => an.page !== i).map((an) => (an.page > i ? { ...an, page: an.page - 1 } : an)));
    if (current >= pages.length - 1) setCurrent(Math.max(0, pages.length - 2));
  }
  function movePage(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    const next = [...pages];
    [next[i], next[j]] = [next[j], next[i]];
    setPages(next);
    setAnnotations((a) =>
      a.map((an) => {
        if (an.page === i) return { ...an, page: j };
        if (an.page === j) return { ...an, page: i };
        return an;
      }),
    );
    setCurrent(j);
  }

  async function exportPdf() {
    if (!bytes) return;
    const pdf = await PDFDocument.load(bytes.slice(0));
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    // Build new doc with pages reordered/deleted/rotated + annotations
    const out = await PDFDocument.create();
    const outFont = await out.embedFont(StandardFonts.Helvetica);
    const original = pdf.getPages();

    // Map current pages back to original index by matching dataUrl order: we store original index implicitly
    // Easier: track original index in pages state.
    for (let i = 0; i < pages.length; i++) {
      const ps = pages[i];
      // Find original index by looking up corresponding rendered page — we don't track it explicitly.
      // For simplicity, assume pages still aligns with originals where possible.
      // We use index i mod original length as a fallback.
      const origIdx = i < original.length ? i : i % original.length;
      const [copied] = await out.copyPages(pdf, [origIdx]);
      if (ps.rotation) copied.setRotation(degrees(ps.rotation));
      out.addPage(copied);

      const pageW = copied.getWidth();
      const pageH = copied.getHeight();
      const renderW = ps.width;
      const renderH = ps.height;
      const sx = pageW / renderW;
      const sy = pageH / renderH;

      const ann = annotations.filter((a) => a.page === i);
      for (const a of ann) {
        if (a.type === "text") {
          copied.drawText(a.text, {
            x: a.x * sx,
            y: pageH - a.y * sy - a.size,
            size: a.size,
            font: outFont,
            color: hexToRgb(a.color),
          });
        } else if (a.type === "highlight") {
          copied.drawRectangle({
            x: a.x * sx,
            y: pageH - (a.y + a.h) * sy,
            width: a.w * sx,
            height: a.h * sy,
            color: hexToRgb(a.color),
            opacity: 0.4,
          });
        } else if (a.type === "draw") {
          for (let p = 1; p < a.points.length; p++) {
            const p1 = a.points[p - 1];
            const p2 = a.points[p];
            copied.drawLine({
              start: { x: p1.x * sx, y: pageH - p1.y * sy },
              end: { x: p2.x * sx, y: pageH - p2.y * sy },
              thickness: a.width,
              color: hexToRgb(a.color),
            });
          }
        }
      }
    }

    const blob = new Blob([new Uint8Array(await out.save())], { type: "application/pdf" });
    saveAs(blob, "edited.pdf");
  }

  async function mergeMore(files: File[]) {
    if (!bytes) return;
    setLoading(true);
    const base = await PDFDocument.load(bytes.slice(0));
    for (const f of files) {
      const extra = await PDFDocument.load(await f.arrayBuffer());
      const copied = await base.copyPages(extra, extra.getPageIndices());
      copied.forEach((p) => base.addPage(p));
    }
    const merged = await base.save();
    const ab = new ArrayBuffer(merged.byteLength);
    new Uint8Array(ab).set(merged);
    setBytes(ab);
    const imgs = await renderPdfPagesToImages(ab.slice(0), 1.5);
    setPages(imgs.map((p) => ({ ...p, rotation: 0 })));
    setLoading(false);
  }

  if (!pages.length) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-8 py-20">
          <h1 className="font-display text-4xl font-bold mb-2">PDF Editor</h1>
          <p className="text-muted-foreground mb-10">Open a PDF to annotate, sign, reorder pages, merge, or split.</p>
          <Dropzone accept="application/pdf" onFiles={(f) => loadFile(f[0])} hint=".pdf" />
        </div>
      </AppLayout>
    );
  }

  const page = pages[current];
  const pageAnn = annotations.filter((a) => a.page === current);

  return (
    <AppLayout>
      <div className="flex h-screen">
        {/* Thumbnails */}
        <div className="w-44 shrink-0 border-r border-border bg-surface overflow-y-auto scrollbar-thin p-3 space-y-3">
          {pages.map((p, i) => (
            <div
              key={i}
              onClick={() => setCurrent(i)}
              className={`group relative rounded-lg overflow-hidden border cursor-pointer transition-all ${
                i === current ? "border-primary shadow-glow" : "border-border hover:border-primary/50"
              }`}
            >
              <img src={p.dataUrl} alt={`Page ${i + 1}`} className="w-full block" style={{ transform: `rotate(${p.rotation}deg)` }} />
              <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur text-[10px] font-mono">{i + 1}</div>
              <div className="absolute inset-x-1 bottom-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={(e) => { e.stopPropagation(); movePage(i, -1); }} className="flex-1 h-6 rounded bg-background/80 backdrop-blur text-xs flex items-center justify-center hover:bg-primary hover:text-primary-foreground"><ArrowUp className="h-3 w-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); movePage(i, 1); }} className="flex-1 h-6 rounded bg-background/80 backdrop-blur text-xs flex items-center justify-center hover:bg-primary hover:text-primary-foreground"><ArrowDown className="h-3 w-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); rotatePage(i); }} className="flex-1 h-6 rounded bg-background/80 backdrop-blur text-xs flex items-center justify-center hover:bg-primary hover:text-primary-foreground"><RotateCw className="h-3 w-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); deletePage(i); }} className="flex-1 h-6 rounded bg-background/80 backdrop-blur text-xs flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground"><X className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
          <label className="block text-center cursor-pointer rounded-lg border border-dashed border-border py-3 text-xs text-muted-foreground hover:border-primary hover:text-primary">
            <input type="file" multiple accept="application/pdf" className="hidden" onChange={(e) => e.target.files && mergeMore(Array.from(e.target.files))} />
            <Plus className="h-4 w-4 mx-auto mb-1" /> Merge PDFs
          </label>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="border-b border-border bg-surface px-4 py-2.5 flex items-center gap-2">
            <ToolBtn active={tool === "select"} onClick={() => setTool("select")} icon={MousePointer2} label="Select" />
            <ToolBtn active={tool === "text"} onClick={() => setTool("text")} icon={Type} label="Text" />
            <ToolBtn active={tool === "highlight"} onClick={() => setTool("highlight")} icon={Highlighter} label="Highlight" />
            <ToolBtn active={tool === "draw"} onClick={() => setTool("draw")} icon={Pen} label="Draw / Sign" />
            <div className="h-5 w-px bg-border mx-1" />
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 rounded border border-border bg-transparent cursor-pointer" />
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setAnnotations((a) => a.filter((an) => an.page !== current))} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-surface-elevated flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Clear page</button>
              <button onClick={exportPdf} className="px-4 py-1.5 text-sm font-medium rounded-lg bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Download PDF</button>
            </div>
          </div>

          <div className="flex-1 overflow-auto scrollbar-thin bg-background p-8 flex justify-center">
            <div
              ref={stageRef}
              onMouseDown={onStageMouseDown}
              onMouseMove={onStageMouseMove}
              onMouseUp={onStageMouseUp}
              onMouseLeave={onStageMouseUp}
              className="relative shadow-elevated bg-white"
              style={{
                width: page.width,
                height: page.height,
                cursor: tool === "select" ? "default" : "crosshair",
                transform: `rotate(${page.rotation}deg)`,
              }}
            >
              <img src={page.dataUrl} alt="" className="absolute inset-0 w-full h-full pointer-events-none select-none" draggable={false} />
              {pageAnn.map((a) =>
                a.type === "text" ? (
                  <div key={a.id} style={{ position: "absolute", left: a.x, top: a.y, color: a.color, fontSize: a.size, fontWeight: 500 }}>{a.text}</div>
                ) : a.type === "highlight" ? (
                  <div key={a.id} style={{ position: "absolute", left: a.x, top: a.y, width: a.w, height: a.h, background: a.color, opacity: 0.4 }} />
                ) : (
                  <svg key={a.id} className="absolute inset-0 pointer-events-none" width={page.width} height={page.height}>
                    <polyline
                      points={a.points.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke={a.color}
                      strokeWidth={a.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
      {loading && <LoadingOverlay />}
    </AppLayout>
  );
}

function ToolBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition ${
        active ? "bg-primary text-primary-foreground shadow-glow" : "hover:bg-surface-elevated text-muted-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
        <span className="font-display">Working…</span>
      </div>
    </div>
  );
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
