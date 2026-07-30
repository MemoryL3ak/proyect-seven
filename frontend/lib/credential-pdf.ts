import { jsPDF } from "jspdf";
import { isAvailable as isNativeBridge, send as nativeSend } from "@/lib/native-bridge";

/**
 * Genera y descarga el PDF de la credencial. Reemplaza el flujo de
 * window.open + imprimir, que en los teléfonos abría una pestaña en negro:
 * aquí el archivo se dibuja directo con jsPDF y se guarda en el dispositivo.
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
};

const NAVY: [number, number, number] = [4, 26, 46];
const NAVY_SOFT: [number, number, number] = [6, 34, 64];
const TEAL: [number, number, number] = [33, 208, 179];
const MUTED: [number, number, number] = [148, 163, 184];

function buildCredentialDoc(data: CredentialPdfData): jsPDF {
  // Tarjeta vertical tipo credencial (media carta aprox.).
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [105, 158] });
  const W = 105;

  // Fondo
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 158, "F");
  doc.setFillColor(...NAVY_SOFT);
  doc.roundedRect(6, 6, W - 12, 146, 4, 4, "F");

  // Franja superior teal
  doc.setFillColor(...TEAL);
  doc.rect(6, 6, W - 12, 2.2, "F");

  // Evento
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.text(doc.splitTextToSize(data.eventName || "Evento", W - 28), W / 2, 17, { align: "center" });

  if (data.countryTag) {
    doc.setFontSize(8);
    doc.setTextColor(...TEAL);
    doc.text(String(data.countryTag).toUpperCase(), W / 2, 24, { align: "center" });
  }

  // Nombre y rol
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  const nameLines = doc.splitTextToSize(data.fullName || "", W - 24) as string[];
  doc.text(nameLines, W / 2, 36, { align: "center" });
  const afterName = 36 + (nameLines.length - 1) * 6.5;

  doc.setFontSize(9.5);
  doc.setTextColor(...TEAL);
  doc.setFont("helvetica", "normal");
  doc.text(data.roleLabel || "", W / 2, afterName + 7, { align: "center" });

  // QR en recuadro blanco
  const qrSize = 56;
  const qrX = (W - qrSize) / 2;
  const qrY = afterName + 13;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 3, 3, "F");
  if (data.qrDataUrl) {
    try {
      doc.addImage(data.qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    } catch {
      // Si el QR no se puede incrustar, la credencial sale igual con el código.
    }
  }

  // Código
  if (data.code) {
    doc.setFontSize(13);
    doc.setFont("courier", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(String(data.code).toUpperCase().split("").join(" "), W / 2, qrY + qrSize + 12, { align: "center" });
  }

  // Pie
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text("Credencial personal e intransferible. Preséntala junto a tu documento de identidad.", W / 2, 143, {
    align: "center",
    maxWidth: W - 24,
  });
  if (data.organization) {
    doc.text(data.organization, W / 2, 148, { align: "center" });
  }

  return doc;
}

function slugFor(data: CredentialPdfData): string {
  return (data.fullName || "credencial").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Descarga el PDF (navegadores normales). */
export function downloadCredentialPdf(data: CredentialPdfData) {
  buildCredentialDoc(data).save(`credencial-${slugFor(data)}.pdf`);
}

/**
 * PDF como data URI, para mostrarlo en un visor propio dentro de la app
 * nativa: doc.save() en el WebView navegaba la página al visor del sistema
 * y era muy difícil volver al portal.
 */
export function credentialPdfDataUri(data: CredentialPdfData): string {
  return buildCredentialDoc(data).output("datauristring");
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
    nativeSend("url.open", { url: `${window.location.origin}/credencial?${params.toString()}` });
    return;
  }
  downloadCredentialPdf(data);
}
