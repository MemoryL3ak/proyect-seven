/**
 * Utilidades de exportación: descarga de datos como CSV y de gráficos como PNG.
 * El PNG se dibuja directamente en un canvas a partir de los datos del gráfico
 * (no captura el SVG de recharts), lo que produce una imagen nítida y estable.
 * Funciona 100% en el navegador, sin dependencias externas.
 */

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(text: string): string {
  return (text || "export")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Descarga un array de objetos como archivo CSV (compatible con Excel). */
export function downloadCSV(
  filename: string,
  rows: Array<Record<string, unknown>>,
  columns?: string[],
) {
  if (!rows || rows.length === 0) return;
  const cols = columns ?? Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const s = value == null ? "" : String(value);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    cols.join(","),
    ...rows.map((row) => cols.map((c) => escape(row[c])).join(",")),
  ].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

/* ── Renderizado de gráficos a PNG ─────────────────────────────────────── */

export type ChartExportSpec = {
  title?: string;
  chartType?: "line" | "bar" | "area";
  xKey: string;
  series: Array<{ key: string; label: string; color?: string }>;
  rows: Array<Record<string, unknown>>;
};

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** Dibuja el gráfico en un canvas y lo descarga como PNG. */
export function downloadChartPng(spec: ChartExportSpec, filename: string) {
  const W = 920;
  const H = 480;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);

  const rows = spec.rows ?? [];
  const series = spec.series ?? [];
  const xKey = spec.xKey ?? "label";

  // Fondo
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, W, H);

  // Título
  ctx.fillStyle = "#f1f5f9";
  ctx.font = "bold 19px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(truncate(spec.title || "Gráfico", 70), 44, 42);

  // Marca
  ctx.fillStyle = "rgba(33,208,179,0.85)";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("SofIA · Seven Arena", W - 32, 40);

  const padL = 64;
  const padR = 32;
  const padT = 72;
  const padB = 96;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  if (rows.length === 0 || series.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sin datos para graficar", W / 2, H / 2);
  } else {
    let maxV = 0;
    rows.forEach((r) =>
      series.forEach((s) => {
        const v = Number(r[s.key]);
        if (Number.isFinite(v) && v > maxV) maxV = v;
      }),
    );
    // Escala con marcas enteras y uniformes: el paso del eje Y siempre es un
    // entero "redondo", así que las marcas no se saltan ni se duplican.
    let step = niceCeil(Math.max(maxV, 1) / 5);
    step = Math.max(1, Math.round(step));
    const ticks = Math.max(1, Math.ceil(maxV / step));
    const niceMax = step * ticks;

    // Grilla + eje Y
    ctx.font = "11px system-ui, sans-serif";
    for (let i = 0; i <= ticks; i++) {
      const y = padT + plotH - (plotH * i) / ticks;
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.textAlign = "right";
      ctx.fillText(String(step * i), padL - 10, y + 4);
    }

    const n = rows.length;
    const slot = plotW / Math.max(1, n);

    // Etiquetas eje X
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.textAlign = "center";
    ctx.font = "11px system-ui, sans-serif";
    rows.forEach((r, i) => {
      const cx = padL + slot * i + slot / 2;
      ctx.fillText(truncate(String(r[xKey] ?? ""), 14), cx, padT + plotH + 22);
    });

    if (spec.chartType === "bar") {
      const groupW = slot * 0.7;
      const barW = groupW / series.length;
      rows.forEach((r, i) => {
        const cx = padL + slot * i + slot / 2;
        series.forEach((s, si) => {
          const v = Number(r[s.key]) || 0;
          const h = niceMax > 0 ? plotH * (v / niceMax) : 0;
          const x = cx - groupW / 2 + barW * si;
          ctx.fillStyle = s.color || "#21D0B3";
          ctx.fillRect(x + 1, padT + plotH - h, Math.max(1, barW - 2), h);
        });
      });
    } else {
      // line / area
      series.forEach((s) => {
        const points: Array<{ x: number; y: number }> = [];
        rows.forEach((r, i) => {
          const v = Number(r[s.key]);
          if (!Number.isFinite(v)) return;
          points.push({
            x: padL + slot * i + slot / 2,
            y: padT + plotH - (niceMax > 0 ? plotH * (v / niceMax) : 0),
          });
        });
        if (points.length === 0) return;
        if (spec.chartType === "area") {
          ctx.fillStyle = (s.color || "#21D0B3") + "33";
          ctx.beginPath();
          ctx.moveTo(points[0].x, padT + plotH);
          points.forEach((p) => ctx.lineTo(p.x, p.y));
          ctx.lineTo(points[points.length - 1].x, padT + plotH);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = s.color || "#21D0B3";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
        points.forEach((p) => {
          ctx.fillStyle = s.color || "#21D0B3";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    }

    // Ejes
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();
  }

  // Leyenda
  ctx.textAlign = "left";
  ctx.font = "12px system-ui, sans-serif";
  let lx = padL;
  series.forEach((s) => {
    ctx.fillStyle = s.color || "#21D0B3";
    ctx.fillRect(lx, H - 34, 13, 13);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(s.label, lx + 19, H - 23);
    lx += 19 + ctx.measureText(s.label).width + 22;
  });

  canvas.toBlob((blob) => {
    if (blob) triggerDownload(blob, filename.endsWith(".png") ? filename : `${filename}.png`);
  }, "image/png");
}
