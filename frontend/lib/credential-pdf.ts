import { jsPDF } from "jspdf";
import { isAvailable as isNativeBridge, send as nativeSend } from "@/lib/native-bridge";

/**
 * Genera y descarga el PDF de la credencial COMPLETA: réplica de la tarjeta
 * de buildCredentialHtml (anverso con franja de país, foto, datos, QR y
 * accesos; reverso con leyenda de accesos y aviso), en una hoja A4 apaisada.
 */
export type CredentialPdfData = {
  eventName: string;
  fullName: string;
  roleLabel: string;
  code?: string;
  countryTag?: string;
  qrDataUrl?: string;
  /** Contenido plano del QR — permite regenerarlo fuera del portal. */
  qrContent?: string;
  organization?: string;
  issuedAtLabel?: string;
  providerLabel?: string;
  photoUrl?: string | null;
  accessTypes?: string[];
};

const STRIP: [number, number, number] = [107, 130, 198];   // #6b82c6
const BORDER: [number, number, number] = [199, 210, 226];  // #c7d2e2
const TEXT: [number, number, number] = [15, 23, 42];       // #0f172a
const MUTED: [number, number, number] = [100, 116, 139];   // #64748b
const PILL_BG: [number, number, number] = [223, 232, 255]; // #dfe8ff
const PILL_TX: [number, number, number] = [107, 125, 171]; // #6b7dab
const PILL_ON: [number, number, number] = [109, 133, 202]; // #6d85ca
const NOTICE: [number, number, number] = [129, 142, 165];  // #818ea5
const NOTICE_LINE: [number, number, number] = [216, 230, 203]; // #d8e6cb
const QR_PANEL: [number, number, number] = [238, 244, 253]; // #eef4fd

const ACCESS_CATALOG = [
  { code: "C", label: "Cancha" },
  { code: "TR", label: "Transporte" },
  { code: "H", label: "Hotel" },
  { code: "R", label: "Reuniones" },
  { code: "A", label: "Alimentacion" },
  { code: "RD", label: "Recintos Deportivos" },
];

/** Descarga una imagen como data URL; null si falla (CORS, 404, etc.). */
async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "") || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG";
}

async function buildCredentialDoc(data: CredentialPdfData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const [photo, logoLeft, logoRight] = await Promise.all([
    data.photoUrl ? fetchImageDataUrl(data.photoUrl) : Promise.resolve(null),
    fetchImageDataUrl("/branding/fupd-left-logo.png"),
    fetchImageDataUrl("/branding/fupd-right-logo.png"),
  ]);

  const country = (data.countryTag || "LOC").toUpperCase().slice(0, 3);
  const activeAccess = new Set((data.accessTypes ?? []).map((v) => v.toUpperCase()));

  const CARD_W = 130;
  const CARD_H = 180;
  const CARD_Y = 15;
  const STRIP_W = 24;

  const drawCardBase = (x: number) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, CARD_Y, CARD_W, CARD_H, 4, 4, "FD");
    // Franja izquierda con país y texto vertical
    doc.setFillColor(...STRIP);
    doc.roundedRect(x, CARD_Y, STRIP_W + 4, CARD_H, 4, 4, "F");
    doc.rect(x + STRIP_W - 4, CARD_Y, 8, CARD_H, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(country, x + STRIP_W / 2, CARD_Y + 14, { align: "center" });
    doc.setFontSize(10);
    doc.text("COMITE OPERATIVO LOCAL", x + STRIP_W / 2 + 2, CARD_Y + CARD_H - 8, { angle: 90 });
    // Logos institucionales
    const logoY = CARD_Y + 4;
    if (logoLeft) {
      try { doc.addImage(logoLeft, imageFormat(logoLeft), x + STRIP_W + 4, logoY, 26, 10); } catch {}
    }
    if (logoRight) {
      try { doc.addImage(logoRight, imageFormat(logoRight), x + CARD_W - 30, logoY, 26, 10); } catch {}
    }
  };

  // ── Anverso ────────────────────────────────────────────────────────────────
  const fx = 13;
  drawCardBase(fx);
  const contentX = fx + STRIP_W + 4;
  const contentW = CARD_W - STRIP_W - 8;
  const centerX = contentX + contentW / 2;

  // Foto
  const photoW = 42;
  const photoH = 50;
  const photoX = centerX - photoW / 2;
  const photoY = CARD_Y + 17;
  if (photo) {
    try {
      doc.addImage(photo, imageFormat(photo), photoX, photoY, photoW, photoH);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, "S");
    } catch {}
  } else {
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, "F");
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("SIN FOTO", centerX, photoY + photoH / 2 + 1, { align: "center" });
  }

  // Nombre y rol
  let cursorY = photoY + photoH + 9;
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const nameLines = doc.splitTextToSize(data.fullName || "", contentW - 4) as string[];
  doc.text(nameLines, centerX, cursorY, { align: "center" });
  cursorY += nameLines.length * 6.2 + 1;

  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);
  doc.text((data.roleLabel || "").toUpperCase(), centerX, cursorY, { align: "center" });
  cursorY += 7;

  // Meta: emitida / proveedor / evento
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT);
  const metaX = contentX + 4;
  const metaLine = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, metaX, cursorY);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(value, contentW - 26) as string[], metaX + 20, cursorY);
    cursorY += 4.6;
  };
  metaLine("Emitida", data.issuedAtLabel || new Date().toLocaleDateString("es-CL"));
  metaLine("Proveedor", data.providerLabel || "No aplica");
  metaLine("Evento", data.organization || "Seven Logistic Core");

  // Panel QR
  const qrSize = 36;
  const qrPanelW = qrSize + 10;
  const qrPanelX = centerX - qrPanelW / 2;
  const qrPanelY = cursorY + 2;
  doc.setFillColor(...QR_PANEL);
  doc.setDrawColor(217, 226, 240);
  doc.roundedRect(qrPanelX, qrPanelY, qrPanelW, qrSize + 15, 3, 3, "FD");
  if (data.qrDataUrl) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(centerX - qrSize / 2 - 2, qrPanelY + 3, qrSize + 4, qrSize + 4, 2, 2, "F");
    try { doc.addImage(data.qrDataUrl, "PNG", centerX - qrSize / 2, qrPanelY + 5, qrSize, qrSize); } catch {}
  }
  doc.setTextColor(79, 95, 130);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("Escanear para ver datos del acceso", centerX, qrPanelY + qrSize + 12, { align: "center" });

  // Código de credencial
  if (data.code) {
    doc.setFont("courier", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT);
    doc.text(String(data.code).toUpperCase().split("").join(" "), centerX, qrPanelY + qrSize + 20, { align: "center" });
  }

  // Pills de acceso
  const pillW = 12.5;
  const pillH = 7;
  const pillGap = 2;
  const totalPills = ACCESS_CATALOG.length * pillW + (ACCESS_CATALOG.length - 1) * pillGap;
  let pillX = centerX - totalPills / 2;
  const pillY = CARD_Y + CARD_H - 17;
  ACCESS_CATALOG.forEach((item) => {
    const active = activeAccess.has(item.code);
    doc.setFillColor(...(active ? PILL_ON : PILL_BG));
    doc.roundedRect(pillX, pillY, pillW, pillH, 2, 2, "F");
    doc.setTextColor(...(active ? [255, 255, 255] as [number, number, number] : PILL_TX));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(item.code, pillX + pillW / 2, pillY + 4.7, { align: "center" });
    pillX += pillW + pillGap;
  });

  // Evento (pie)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(doc.splitTextToSize(data.eventName || "", contentW) as string[], centerX, CARD_Y + CARD_H - 5, { align: "center" });

  // ── Reverso ────────────────────────────────────────────────────────────────
  const bx = 154;
  drawCardBase(bx);
  const bContentX = bx + STRIP_W + 4;
  const bContentW = CARD_W - STRIP_W - 8;
  const bCenterX = bContentX + bContentW / 2;

  // Leyenda de accesos (2 columnas)
  let legendY = CARD_Y + 26;
  const colW = bContentW / 2;
  ACCESS_CATALOG.forEach((item, i) => {
    const col = i % 2;
    const lx = bContentX + 3 + col * colW;
    const active = activeAccess.has(item.code);
    doc.setFillColor(...(active ? PILL_ON : PILL_BG));
    doc.roundedRect(lx, legendY - 4.5, 13, 6.5, 2, 2, "F");
    doc.setTextColor(...(active ? [255, 255, 255] as [number, number, number] : PILL_TX));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(item.code, lx + 6.5, legendY - 0.2, { align: "center" });
    doc.setTextColor(107, 114, 128);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(doc.splitTextToSize(item.label, colW - 17) as string[], lx + 15.5, legendY - 0.5);
    if (col === 1) legendY += 12;
  });

  // Aviso
  const noticeY = legendY + 14;
  doc.setDrawColor(...NOTICE_LINE);
  doc.setLineWidth(0.8);
  doc.line(bContentX + 2, noticeY, bContentX + bContentW - 2, noticeY);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...NOTICE);
  const noticeLines = [
    "Esta credencial es personal e intransferible.",
    "Debe portarse en forma permanente y visible",
    "durante el evento.",
    "En caso de pérdida, favor devolverla a la",
    "organización.",
  ];
  doc.text(noticeLines, bCenterX, noticeY + 9, { align: "center", lineHeightFactor: 1.5 });
  doc.line(bContentX + 2, noticeY + 44, bContentX + bContentW - 2, noticeY + 44);

  // Social (pie)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...STRIP);
  doc.text("@indchile", bCenterX, CARD_Y + CARD_H - 16, { align: "center" });
  doc.setFontSize(10);
  doc.text("www.ind.cl", bCenterX, CARD_Y + CARD_H - 10, { align: "center" });

  return doc;
}

function slugFor(data: CredentialPdfData): string {
  return (data.fullName || "credencial").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Descarga el PDF (navegadores normales). */
export async function downloadCredentialPdf(data: CredentialPdfData): Promise<void> {
  try {
    const doc = await buildCredentialDoc(data);
    doc.save(`credencial-${slugFor(data)}.pdf`);
  } catch {
    // Nunca romper el portal por un fallo de descarga.
  }
}

/**
 * Guarda la credencial en el dispositivo, también dentro de la app nativa.
 *
 * En el WebView, doc.save() no descarga nada (el shell bloquea la navegación
 * a blob:). En su lugar se abre el navegador del sistema (puente `url.open`,
 * el mismo de los números de emergencia) en /credencial, una página que
 * regenera el PDF y lo descarga de verdad. En un navegador normal se
 * descarga directo.
 */
export function saveCredentialPdf(data: CredentialPdfData) {
  if (isNativeBridge()) {
    const params = new URLSearchParams();
    params.set("e", data.eventName || "");
    params.set("n", data.fullName || "");
    params.set("r", data.roleLabel || "");
    if (data.code) params.set("c", data.code);
    if (data.countryTag) params.set("t", data.countryTag);
    if (data.organization) params.set("o", data.organization);
    if (data.qrContent) params.set("q", data.qrContent);
    if (data.issuedAtLabel) params.set("d", data.issuedAtLabel);
    if (data.providerLabel) params.set("p", data.providerLabel);
    if (data.photoUrl) params.set("f", data.photoUrl);
    if (data.accessTypes?.length) params.set("a", data.accessTypes.join(","));
    nativeSend("url.open", { url: `${window.location.origin}/credencial?${params.toString()}` });
    return;
  }
  void downloadCredentialPdf(data);
}
