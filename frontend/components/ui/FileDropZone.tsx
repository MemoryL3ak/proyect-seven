"use client";

import { useRef, useState } from "react";
import { CheckIcon, UploadIcon } from "@/components/ui/Icons";

type FileDropZoneProps = {
  accept?: string;
  onFile: (file: File) => void;
  hint?: string;
  selectedFileName?: string | null;
  selectedDetail?: string;
  disabled?: boolean;
};

export default function FileDropZone({
  accept = ".csv,.xls,.xlsx",
  onFile,
  hint = "Arrastra un archivo o haz click para seleccionar",
  selectedFileName,
  selectedDetail,
  disabled = false,
}: FileDropZoneProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !disabled && ref.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") ref.current?.click();
      }}
      className="cursor-pointer transition-all rounded-xl border-2 border-dashed p-8 text-center"
      style={{
        borderColor: dragging ? "#1f4e8c" : selectedFileName ? "#2e7d32" : "#d0d7de",
        background: dragging
          ? "linear-gradient(135deg, #eef4fb 0%, #d6e4f5 100%)"
          : selectedFileName
          ? "linear-gradient(135deg, #f7fcf8 0%, #e7f5ec 100%)"
          : "#fafbfc",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        onChange={onChange}
        className="sr-only"
        disabled={disabled}
      />

      <div className="flex flex-col items-center gap-3">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{
            background: selectedFileName
              ? "linear-gradient(135deg, #e7f5ec 0%, #c9ead2 100%)"
              : "linear-gradient(135deg, #eef4fb 0%, #d6e4f5 100%)",
          }}
        >
          {selectedFileName ? (
            <CheckIcon size={28} color="#2e7d32" strokeWidth={2} />
          ) : (
            <UploadIcon size={28} color="#1f4e8c" strokeWidth={1.8} />
          )}
        </div>

        {selectedFileName ? (
          <div>
            <p className="text-sm font-semibold" style={{ color: "#1e5125" }}>
              {selectedFileName}
            </p>
            {selectedDetail && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {selectedDetail}
              </p>
            )}
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              Click para reemplazar
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium">{hint}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Formatos: CSV, XLS, XLSX
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
