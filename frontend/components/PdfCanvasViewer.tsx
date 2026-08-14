"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAvailable as isNativeBridge, send as nativeSend } from "@/lib/native-bridge";

/**
 * Visor de PDF que dibuja el documento completo con PDF.js.
 *
 * Un <iframe src="...pdf"> sólo muestra la primera página en iOS y no muestra
 * nada en el WebView de Android, así que dependía del visor del sistema. Aquí
 * cada página se dibuja en su propio canvas y el documento se recorre
 * desplazándose, igual en el navegador y dentro de la app.
 *
 * Las páginas se dibujan a medida que se acercan a la pantalla: un informativo
 * de 40 páginas no puede rasterizarse entero de una vez en un teléfono.
 */

type PdfPageProxy = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void>; cancel: () => void };
  cleanup: () => void;
};
type PdfDocProxy = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPageProxy>;
  destroy: () => Promise<void>;
};

const MAX_DPR = 2;        // más resolución no se nota y multiplica la memoria
const PRERENDER_MARGIN = "800px";

export default function PdfCanvasViewer({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PdfDocProxy | null>(null);
  const renderedRef = useRef<Set<number>>(new Set());

  const [numPages, setNumPages] = useState(0);
  const [baseWidth, setBaseWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // Ancho disponible: define la escala con la que se dibuja cada página.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setBaseWidth(el.clientWidth - 24);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Carga del documento.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    renderedRef.current = new Set();

    (async () => {
      try {
        // Build `legacy`: el WebView de la app no siempre soporta la sintaxis
        // del build moderno y el visor fallaba entero.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

        // El worker va DENTRO del bundle. Importarlo registra
        // globalThis.pdfjsWorker, y PDF.js lo usa tal cual sin descargar nada:
        // servirlo como archivo estático fallaba con "'text/html' is not a
        // valid JavaScript MIME type" porque el hosting devolvía la página en
        // vez del script.
        await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
        // Sólo se usa si el WebView sí puede crear un Worker de verdad; si no,
        // PDF.js cae al handler ya registrado arriba.
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

        const doc = (await pdfjs.getDocument({
          url: src,
          // Sin estas dos, en algunos WebView el visor queda en blanco.
          isEvalSupported: false,
          useSystemFonts: false,
        }).promise) as unknown as PdfDocProxy;
        if (cancelled) { void doc.destroy(); return; }
        docRef.current = doc;
        setNumPages(doc.numPages);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        // El detalle se muestra en pantalla: sin consola en la app móvil, es
        // la única forma de saber por qué falló.
        setErrorDetail(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      const doc = docRef.current;
      docRef.current = null;
      if (doc) void doc.destroy();
    };
  }, [src]);

  const renderPage = useCallback(async (pageNumber: number, holder: HTMLDivElement) => {
    const doc = docRef.current;
    if (!doc || !baseWidth || renderedRef.current.has(pageNumber)) return;
    renderedRef.current.add(pageNumber);

    try {
      const page = await doc.getPage(pageNumber);
      const unscaled = page.getViewport({ scale: 1 });
      const scale = (baseWidth * zoom) / unscaled.width;
      const viewport = page.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.style.display = "block";
      canvas.style.borderRadius = "6px";

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      await page.render({ canvasContext: ctx, viewport }).promise;

      holder.replaceChildren(canvas);
      page.cleanup();
    } catch {
      renderedRef.current.delete(pageNumber);
    }
  }, [baseWidth, zoom]);

  /** En el WebView un <a target="_blank"> no hace nada: hay que usar el puente. */
  const openExternally = useCallback(() => {
    if (isNativeBridge()) nativeSend("url.open", { url: src });
    else window.open(src, "_blank", "noopener");
  }, [src]);

  // Al cambiar el zoom hay que redibujar todo.
  useEffect(() => { renderedRef.current = new Set(); }, [zoom, baseWidth]);

  // Dibuja las páginas que se acercan a la pantalla.
  useEffect(() => {
    if (status !== "ready" || !numPages || !baseWidth) return;
    const root = containerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const holder = entry.target as HTMLDivElement;
          const n = Number(holder.dataset.page);
          if (n) void renderPage(n, holder);
        }
      },
      { root, rootMargin: PRERENDER_MARGIN },
    );

    const holders = root.querySelectorAll<HTMLDivElement>("[data-page]");
    holders.forEach(h => observer.observe(h));
    return () => observer.disconnect();
  }, [status, numPages, baseWidth, renderPage]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#334155" }}>
      {status === "ready" && numPages > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: "6px 10px", background: "rgba(4,26,46,0.9)", flexShrink: 0,
        }}>
          <button type="button" onClick={() => setZoom(z => Math.max(0.6, +(z - 0.25).toFixed(2)))}
            aria-label="Alejar" style={zoomBtn}>−</button>
          <span style={{ fontSize: 12, color: "#94a3b8", minWidth: 96, textAlign: "center" }}>
            {numPages} {numPages === 1 ? "página" : "páginas"} · {Math.round(zoom * 100)}%
          </span>
          <button type="button" onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}
            aria-label="Acercar" style={zoomBtn}>+</button>
        </div>
      )}

      <div ref={containerRef} style={{ flex: 1, overflow: "auto", padding: 12, WebkitOverflowScrolling: "touch" }}>
        {status === "loading" && (
          <p style={{ color: "#cbd5e1", fontSize: 13, textAlign: "center", padding: "28px 12px" }}>
            Cargando documento…
          </p>
        )}

        {status === "error" && (
          <div style={{ textAlign: "center", padding: "28px 12px" }}>
            <p style={{ color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>
              No se pudo mostrar el documento aquí.
            </p>
            <button
              type="button"
              onClick={openExternally}
              style={{
                padding: "10px 18px", borderRadius: 10, cursor: "pointer",
                background: "rgba(33,208,179,0.15)", border: "1px solid rgba(52,243,198,0.4)",
                color: "#34F3C6", fontSize: 13, fontWeight: 700,
              }}>
              Abrir en el navegador
            </button>
            {errorDetail && (
              <p style={{ marginTop: 16, color: "#64748b", fontSize: 10.5, wordBreak: "break-word" }}>
                {errorDetail}
              </p>
            )}
          </div>
        )}

        {status === "ready" && Array.from({ length: numPages }, (_, i) => (
          <div
            key={`${zoom}-${baseWidth}-${i}`}
            data-page={i + 1}
            style={{
              // Alto provisional: se ajusta solo al insertarse el canvas.
              minHeight: 220, marginBottom: 12, background: "#fff",
              borderRadius: 6, boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

const zoomBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)",
  color: "#fff", fontSize: 17, fontWeight: 700, lineHeight: 1,
};
