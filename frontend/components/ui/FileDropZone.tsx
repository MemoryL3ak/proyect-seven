"use client";

import { useRef, useState } from "react";
import { CheckIcon, UploadIcon } from "@/components/ui/Icons";
import { STATE, SURFACE } from "@/lib/design";

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
        borderColor: dragging ? STATE.infoText : selectedFileName ? STATE.successText : "#d0d7de",
        background: dragging
          ? "linear-gradient(135deg, #eef4fb 0%, #d6e4f5 100%)"
          : selectedFileName
          ? `linear-gradient(135deg, #f7fcf8 0%, ${STATE.successSoft} 100%)`
          : SURFACE.bg,
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
              ? `linear-gradient(135deg, ${STATE.successSoft} 0%, #c9ead2 100%)`
              : "linear-gradient(135deg, #eef4fb 0%, #d6e4f5 100%)",
          }}
        >
          {selectedFileName ? (
            <CheckIcon size={28} color={STATE.successText} strokeWidth={2} />
          ) : (
            <UploadIcon size={28} color={STATE.infoText} strokeWidth={1.8} />
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
