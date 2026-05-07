import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Dropzone } from "@/components/Dropzone";
import { useState } from "react";
import { renderPdfPagesToImages } from "@/lib/pdf";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Repeat, FileImage, FileText, Loader2 } from "lucide-react";

export const Route = createFileRoute("/convert")({
  component: ConvertPage,
  head: () => ({ meta: [{ title: "Convert — Loomdocs" }, { name: "description", content: "Convert PDFs to images, images to PDF, and DOCX to PDF, all in your browser." }] }),
});

type Mode = "pdf-to-images" | "images-to-pdf" | "docx-to-pdf";

const modes: { id: Mode; title: string; desc: string; accept: string; multiple?: boolean }[] = [
  { id: "pdf-to-images", title: "PDF → Images", desc: "Export each page as PNG.", accept: "application/pdf" },
  { id: "images-to-pdf", title: "Images → PDF", desc: "Combine PNG/JPG into one PDF.", accept: "image/*", multiple: true },
  { id: "docx-to-pdf", title: "DOCX → PDF", desc: "Convert .docx into a styled PDF.", accept: ".docx" },
];

function ConvertPage() {
  const [mode, setMode] = useState<Mode>("pdf-to-images");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function handle(files: File[]) {
    setBusy(true);
    setDone(null);
    try {
      if (mode === "pdf-to-images") {
        const buf = await files[0].arrayBuffer();
        const pages = await renderPdfPagesToImages(buf, 2);
        const zip = new JSZip();
        for (let i = 0; i < pages.length; i++) {
          const blob = await (await fetch(pages[i].dataUrl)).blob();
          zip.file(`page-${String(i + 1).padStart(3, "0")}.png`, blob);
        }
        const out = await zip.generateAsync({ type: "blob" });
        saveAs(out, files[0].name.replace(/\.pdf$/i, "") + "-images.zip");
        setDone(`${pages.length} pages exported`);
      } else if (mode === "images-to-pdf") {
        const pdf = await PDFDocument.create();
        for (const f of files) {
          const bytes = new Uint8Array(await f.arrayBuffer());
          const isPng = f.type === "image/png" || f.name.toLowerCase().endsWith(".png");
          const img = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          const page = pdf.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        }
        const out = await pdf.save();
        saveAs(new Blob([new Uint8Array(out)], { type: "application/pdf" }), "images.pdf");
        setDone(`PDF created from ${files.length} images`);
      } else if (mode === "docx-to-pdf") {
        const mammoth = await import("mammoth");
        const buf = await files[0].arrayBuffer();
        const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });
        // Print-to-PDF approach: open new window with styled HTML, trigger print
        const w = window.open("", "_blank");
        if (!w) throw new Error("Popup blocked");
        w.document.write(`<!doctype html><meta charset="utf-8"><title>${files[0].name}</title>
          <style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#111}
          h1,h2,h3{font-family:'Helvetica Neue',Arial,sans-serif;margin-top:1.4em}
          table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 10px}
          img{max-width:100%}</style>${html}
          <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>`);
        w.document.close();
        setDone("Print dialog opened — choose 'Save as PDF'");
      }
    } catch (e: any) {
      alert(e?.message || "Conversion failed");
    } finally {
      setBusy(false);
    }
  }

  const m = modes.find((x) => x.id === mode)!;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow"><Repeat className="h-5 w-5 text-primary-foreground" /></div>
          <h1 className="font-display text-4xl font-bold">Convert</h1>
        </div>
        <p className="text-muted-foreground mb-10">Pick a conversion, drop your file, and download the result.</p>

        <div className="grid sm:grid-cols-3 gap-3 mb-8">
          {modes.map((x) => (
            <button
              key={x.id}
              onClick={() => { setMode(x.id); setDone(null); }}
              className={`text-left p-5 rounded-xl border transition-all ${
                mode === x.id ? "border-primary bg-primary/5 shadow-glow" : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <p className="font-display font-semibold mb-1">{x.title}</p>
              <p className="text-xs text-muted-foreground">{x.desc}</p>
            </button>
          ))}
        </div>

        {busy ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-3" />
            <p className="font-display">Converting…</p>
          </div>
        ) : (
          <Dropzone key={mode} accept={m.accept} multiple={m.multiple} onFiles={handle} hint={m.accept} />
        )}

        {done && (
          <div className="mt-6 rounded-xl border border-success/30 bg-success/10 px-5 py-4 text-sm">
            ✓ {done}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
