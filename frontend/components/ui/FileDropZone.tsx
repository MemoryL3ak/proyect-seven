"use client";

import { useRef, useState } from "react";

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
  hint = "Arrastrá un archivo o hacé click para seleccionar",
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
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2e7d32"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1f4e8c"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
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
