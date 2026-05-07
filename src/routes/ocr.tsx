import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Dropzone } from "@/components/Dropzone";
import { useState } from "react";
import { renderPdfPagesToImages } from "@/lib/pdf";
import { saveAs } from "file-saver";
import { Copy, Download, ScanText, Loader2 } from "lucide-react";

export const Route = createFileRoute("/ocr")({
  component: OcrPage,
  head: () => ({ meta: [{ title: "Scan & OCR — Loomdocs" }, { name: "description", content: "Extract editable text from scanned PDFs and images using in-browser OCR." }] }),
});

function OcrPage() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [text, setText] = useState("");
  const [pageCount, setPageCount] = useState(0);

  async function run(files: File[]) {
    const file = files[0];
    setBusy(true);
    setText("");
    setProgress(0);
    setStatus("Preparing…");

    const Tesseract = (await import("tesseract.js")).default;

    const images: string[] = [];
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setStatus("Rendering PDF pages…");
      const buf = await file.arrayBuffer();
      const pages = await renderPdfPagesToImages(buf, 2);
      pages.forEach((p) => images.push(p.dataUrl));
    } else {
      images.push(URL.createObjectURL(file));
    }
    setPageCount(images.length);

    let combined = "";
    for (let i = 0; i < images.length; i++) {
      setStatus(`Recognizing page ${i + 1} of ${images.length}…`);
      const result = await Tesseract.recognize(images[i], "eng", {
        logger: (m: any) => {
          if (m.status === "recognizing text") setProgress(m.progress);
        },
      });
      combined += (i ? `\n\n--- Page ${i + 1} ---\n\n` : "") + result.data.text.trim();
      setText(combined);
    }
    setStatus("Done");
    setBusy(false);
  }

  function download() {
    saveAs(new Blob([text], { type: "text/plain;charset=utf-8" }), "extracted-text.txt");
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow"><ScanText className="h-5 w-5 text-primary-foreground" /></div>
          <h1 className="font-display text-4xl font-bold">Scan & OCR</h1>
        </div>
        <p className="text-muted-foreground mb-10">Upload a scanned PDF or image. Text recognition runs locally in your browser.</p>

        {!text && !busy && <Dropzone accept="application/pdf,image/*" onFiles={run} hint=".pdf, .png, .jpg" />}

        {busy && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
            <p className="font-display text-lg">{status}</p>
            {pageCount > 0 && (
              <div className="mt-6 max-w-md mx-auto">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{Math.round(progress * 100)}%</p>
              </div>
            )}
          </div>
        )}

        {text && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface">
              <p className="text-sm text-muted-foreground">{text.length.toLocaleString()} characters · {pageCount} page(s)</p>
              <div className="flex gap-2">
                <button onClick={() => navigator.clipboard.writeText(text)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-surface-elevated flex items-center gap-1.5"><Copy className="h-3.5 w-3.5" /> Copy</button>
                <button onClick={download} className="px-3 py-1.5 text-sm rounded-lg bg-gradient-primary text-primary-foreground shadow-glow flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Download .txt</button>
                <button onClick={() => { setText(""); setProgress(0); setPageCount(0); }} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-surface-elevated">New</button>
              </div>
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full h-[60vh] bg-background p-6 font-mono text-sm outline-none resize-none scrollbar-thin" />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
