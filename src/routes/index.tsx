import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { FileText, FileEdit, ScanText, Repeat, ArrowRight, Shield, Zap, Lock } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Loomdocs — All-in-one PDF & Document Editor" },
      { name: "description", content: "Edit PDFs, documents, and scanned files in your browser. Annotate, sign, OCR, convert — 100% private." },
    ],
  }),
});

const tools = [
  { to: "/pdf", icon: FileText, title: "PDF Editor", desc: "Annotate, add text, sign, merge, split, reorder pages.", tone: "from-indigo-500/20 to-violet-500/20" },
  { to: "/editor", icon: FileEdit, title: "Document Editor", desc: "Rich text editing. Import .docx, export to .docx or PDF.", tone: "from-fuchsia-500/20 to-pink-500/20" },
  { to: "/ocr", icon: ScanText, title: "Scanned Doc OCR", desc: "Extract editable text from images and scanned PDFs.", tone: "from-cyan-500/20 to-blue-500/20" },
  { to: "/convert", icon: Repeat, title: "Convert", desc: "PDF ↔ images, images → PDF, DOCX → PDF.", tone: "from-amber-500/20 to-orange-500/20" },
];

function Home() {
  return (
    <AppLayout>
      <div className="bg-mesh min-h-full">
        <div className="max-w-6xl mx-auto px-8 py-16">
          <header className="mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-elevated border border-border text-xs text-muted-foreground mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              No upload. No account. No tracking.
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] max-w-4xl">
              The all-in-one <span className="text-gradient">document workspace</span>.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-2xl">
              Edit PDFs, write docs, OCR scans, and convert formats — all running locally in your browser.
            </p>
          </header>

          <div className="grid md:grid-cols-2 gap-5">
            {tools.map((t) => {
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-7 hover:border-primary/40 transition-all hover:-translate-y-1 hover:shadow-elevated"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${t.tone} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="relative">
                    <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-5 shadow-glow">
                      <Icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <h3 className="font-display text-2xl font-semibold mb-1.5">{t.title}</h3>
                    <p className="text-sm text-muted-foreground mb-5">{t.desc}</p>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
                      Open <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <section className="mt-20 grid md:grid-cols-3 gap-6">
            {[
              { icon: Lock, title: "Fully private", desc: "Files are processed in your browser. Nothing is uploaded." },
              { icon: Zap, title: "Instant", desc: "No queues, no waiting. Edit and export immediately." },
              { icon: Shield, title: "Works offline", desc: "Once loaded, the app works without internet." },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-xl border border-border bg-surface p-5">
                  <Icon className="h-5 w-5 text-primary mb-3" />
                  <h4 className="font-display font-semibold mb-1">{f.title}</h4>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
