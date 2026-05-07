import { Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

export function Dropzone({
  accept,
  multiple,
  onFiles,
  hint,
}: {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handle = (files: FileList | null) => {
    if (!files || !files.length) return;
    onFiles(Array.from(files));
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setDrag(false);
        handle(e.dataTransfer.files);
      }}
      className={`group cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
        drag
          ? "border-primary bg-primary/5 shadow-glow"
          : "border-border hover:border-primary/50 hover:bg-surface-elevated"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
      <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-glow">
        <Upload className="h-6 w-6 text-primary-foreground" />
      </div>
      <p className="font-display font-semibold text-lg">Drop your file here</p>
      <p className="text-sm text-muted-foreground mt-1">or click to browse {hint ? `· ${hint}` : ""}</p>
    </div>
  );
}
