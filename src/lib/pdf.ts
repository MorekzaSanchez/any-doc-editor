// Browser-only PDF helpers. Lazy-load pdfjs to avoid SSR issues.
export async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  // Use the bundled worker (vite worker import)
  // @ts-ignore
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs;
}

export async function renderPdfPagesToImages(
  data: ArrayBuffer,
  scale = 1.5,
): Promise<{ dataUrl: string; width: number; height: number }[]> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data }).promise;
  const out: { dataUrl: string; width: number; height: number }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    out.push({ dataUrl: canvas.toDataURL("image/png"), width: viewport.width, height: viewport.height });
  }
  return out;
}
