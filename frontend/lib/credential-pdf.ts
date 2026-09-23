import { jsPDF } from "jspdf";
import { isAvailable as isNativeBridge, send as nativeSend } from "@/lib/native-bridge";
import {
  CARA,
  CREDENCIAL_COLORES,
  CREDENCIAL_IMAGENES,
  CREDENCIAL_TEXTOS,
  categoriaCredencial,
  zonasConcedidas,
} from "@/lib/credencial-jde";

/**
 * PDF de la credencial con el formato oficial de los Juegos Deportivos
 * Escolares 2026: las dos caras (frente y reverso) una al lado de la otra en
 * una hoja A4 apaisada, cada una de 105 × 140 mm (A6), listas para recortar.
 * Dibuja lo mismo que buildCredentialHtml leyendo la misma geometría de
 * lib/credencial-jde.
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
  userType?: string | null;
  subjectType?: "PARTICIPANT" | "DRIVER";
  detailLabel?: string | null;
  categoria?: string | null;
  letra?: string | null;
};

type RGB = [number, number, number];
const rgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const OSCURO = rgb(CREDENCIAL_COLORES.oscuro);
const NARANJO = rgb(CREDENCIAL_COLORES.naranjo);
const BLANCO: RGB = [255, 255, 255];

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

/** Tamaño natural de una imagen (para respetar su proporción al colocarla). */
function imageSize(dataUrl: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function buildCredentialDoc(data: CredentialPdfData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const origen = typeof window !== "undefined" ? window.location.origin : "";
  const [foto, logoFrente, logoReverso, redes] = await Promise.all([
    data.photoUrl ? fetchImageDataUrl(data.photoUrl) : Promise.resolve(null),
    fetchImageDataUrl(`${origen}${CREDENCIAL_IMAGENES.logoFrente}`),
    fetchImageDataUrl(`${origen}${CREDENCIAL_IMAGENES.logoReverso}`),
    fetchImageDataUrl(`${origen}${CREDENCIAL_IMAGENES.redes}`),
  ]);

  const cat = categoriaCredencial({
    userType: data.userType,
    roleLabel: data.roleLabel,
    subjectType: data.subjectType,
    categoria: data.categoria,
    letra: data.letra,
  });
  const zonas = zonasConcedidas(data.accessTypes);
  const F = CARA.frente;
  const R = CARA.reverso;

  // Cada cara: 105 × 140 mm (misma proporción 1240 × 1654 que el formato).
  const W = 105;
  const H = (W * CARA.alto) / CARA.ancho;
  const TOP = (210 - H) / 2;
  const GAP = 6;
  const X_FRENTE = (297 - (2 * W + GAP)) / 2;
  const X_REVERSO = X_FRENTE + W + GAP;
  /** Puntos tipográficos equivalentes a una fracción del ancho de la cara. */
  const pt = (fraccion: number) => (fraccion * W) / 0.3528;

  const imagenProporcional = (dataUrl: string | null, x: number, y: number, w: number, natural: { w: number; h: number } | null) => {
    if (!dataUrl) return;
    const h = natural ? (w * natural.h) / natural.w : w * 0.43;
    try {
      doc.addImage(dataUrl, imageFormat(dataUrl), x, y, w, h);
    } catch {
      /* imagen inválida: la credencial sale igual */
    }
  };
  const [tamLogoF, tamLogoR, tamRedes] = await Promise.all([
    logoFrente ? imageSize(logoFrente) : null,
    logoReverso ? imageSize(logoReverso) : null,
    redes ? imageSize(redes) : null,
  ]);

  const dibujarZonas = (x0: number, yCodigo: number, conNombre: boolean) => {
    const zw = F.zonas.ancho * W;
    const gap = F.zonas.gap * W;
    const codigoAlto = F.zonas.codigoFuente * W * 1.2;
    const nombreAlto = F.zonas.nombreAlto * W;
    zonas.forEach((z, i) => {
      const x = x0 + i * (zw + gap);
      doc.setFillColor(...NARANJO);
      doc.rect(x, yCodigo, zw, codigoAlto, "F");
      doc.setTextColor(...BLANCO);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(pt(F.zonas.codigoFuente));
      doc.text(z.codigo, x + zw / 2, yCodigo + codigoAlto * 0.74, { align: "center" });
      if (conNombre) {
        doc.setFillColor(...OSCURO);
        doc.rect(x, yCodigo + codigoAlto, zw, nombreAlto, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(pt(F.zonas.nombreFuente));
        const lineas = z.nombre.split("\n");
        const lh = F.zonas.nombreFuente * W * 1.15;
        const y0 = yCodigo + codigoAlto + nombreAlto / 2 - ((lineas.length - 1) * lh) / 2 + lh * 0.35;
        lineas.forEach((l, li) => doc.text(l, x + zw / 2, y0 + li * lh, { align: "center" }));
      }
    });
  };

  // ── Frente ─────────────────────────────────────────────────────────────────
  {
    const x = X_FRENTE;
    const y = TOP;
    doc.setFillColor(255, 255, 253);
    doc.rect(x, y, W, H, "F");
    // Franja lateral: bloque de la letra y franja oscura con la esquina
    // inferior derecha redondeada (100 % del ancho, 22 % del alto).
    const lw = F.lateralAncho * W;
    const bh = F.bloqueAlto * H;
    doc.setFillColor(...rgb(cat.color));
    doc.rect(x, y, lw, bh, "F");
    doc.setFillColor(...OSCURO);
    const franjaAlto = H - bh;
    const ry = franjaAlto * 0.22;
    doc.rect(x, y + bh, lw, franjaAlto - ry, "F");
    doc.ellipse(x, y + H - ry, lw, ry, "F");
    // La elipse sobresale a la izquierda de la cara: se tapa con el fondo.
    doc.setFillColor(255, 255, 255);
    doc.rect(x - lw - 1, y + bh, lw + 1, franjaAlto + 1, "F");
    // Letra
    doc.setTextColor(...BLANCO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(pt(cat.letra.length > 1 ? F.letraFuente * 0.62 : F.letraFuente));
    doc.text(cat.letra, x + lw / 2, y + bh / 2 + (F.letraFuente * W) * (cat.letra.length > 1 ? 0.22 : 0.36), { align: "center" });
    // Categoría vertical (de abajo hacia arriba), centrada en la franja
    doc.setFontSize(pt(cat.categoria.length > 10 ? F.categoriaFuente * 0.7 : F.categoriaFuente));
    const catAncho = doc.getTextWidth(cat.categoria);
    const franjaCentroY = y + bh + (franjaAlto - franjaAlto * 0.12) / 2;
    const fuenteMm = (cat.categoria.length > 10 ? F.categoriaFuente * 0.7 : F.categoriaFuente) * W;
    doc.text(cat.categoria, x + lw / 2 + fuenteMm * 0.35, franjaCentroY + catAncho / 2, { angle: 90 });
    // Logos
    imagenProporcional(logoFrente, x + F.logos.x * W, y + F.logos.y * H, F.logos.w * W, tamLogoF);
    // Datos: foto, nombre, detalle
    const dx = x + F.datos.x * W;
    const dw = (F.datos.xFin - F.datos.x) * W;
    const dcx = dx + dw / 2;
    const fw = F.fotoAncho * dw;
    const fh = (fw * 4) / 3;
    const fy = y + F.datos.y * H;
    if (foto) {
      try {
        doc.addImage(foto, imageFormat(foto), dcx - fw / 2, fy, fw, fh);
      } catch {
        /* sin foto */
      }
    } else {
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(183, 186, 194);
      doc.setLineDashPattern([1, 1], 0);
      doc.rect(dcx - fw / 2, fy, fw, fh, "FD");
      doc.setLineDashPattern([], 0);
      doc.setTextColor(154, 158, 168);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("SIN FOTO", dcx, fy + fh / 2 + 1, { align: "center" });
    }
    let cy = fy + fh + H * 0.03;
    doc.setTextColor(...OSCURO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(pt(F.nombreFuente));
    const nombre = (data.fullName || "").toUpperCase();
    const nombreLineas = doc.splitTextToSize(nombre, dw) as string[];
    const nombreLh = F.nombreFuente * W * 1.1;
    nombreLineas.forEach((l, i) => doc.text(l, dcx, cy + nombreLh * 0.85 + i * nombreLh, { align: "center" }));
    cy += nombreLineas.length * nombreLh + H * 0.01;
    const detalle = (data.detailLabel ?? "").trim();
    if (detalle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(pt(F.detalleFuente));
      const detLineas = doc.splitTextToSize(detalle, dw) as string[];
      const detLh = F.detalleFuente * W * 1.2;
      detLineas.forEach((l, i) => doc.text(l, dcx, cy + detLh * 0.85 + i * detLh, { align: "center" }));
    }
    // Zonas
    const zonasAlto = F.zonas.codigoFuente * W * 1.2 + F.zonas.nombreAlto * W;
    dibujarZonas(x + F.zonas.x * W, y + H - F.zonas.yDesdeAbajo * H - zonasAlto, true);
  }

  // ── Reverso ────────────────────────────────────────────────────────────────
  {
    const x = X_REVERSO;
    const y = TOP;
    doc.setFillColor(...OSCURO);
    doc.rect(x, y, W, H, "F");
    imagenProporcional(logoReverso, x + R.logos.x * W, y + R.logos.y * H, R.logos.w * W, tamLogoR);
    // QR y código
    if (data.qrDataUrl) {
      const qw = R.qr.w * W;
      const qx = x + R.qr.x * W;
      const qy = y + R.qr.y * H;
      doc.setFillColor(...BLANCO);
      doc.roundedRect(qx, qy, qw, qw, 1.2, 1.2, "F");
      try {
        doc.addImage(data.qrDataUrl, "PNG", qx + 1, qy + 1, qw - 2, qw - 2);
      } catch {
        /* QR inválido */
      }
      if (data.code) {
        doc.setTextColor(...BLANCO);
        doc.setFont("courier", "bold");
        doc.setFontSize(8.5);
        doc.text(String(data.code).toUpperCase().split("").join(" "), qx + qw / 2, qy + qw + 4, { align: "center" });
      }
    }
    // Zonas (sólo el código)
    dibujarZonas(x + R.zonas.x * W, y + R.zonas.y * H, false);
    // Aviso entre dos líneas
    const ax = x + R.aviso.x * W;
    const aw = (R.aviso.xFin - R.aviso.x) * W;
    const ay = y + R.aviso.y * H;
    doc.setDrawColor(...BLANCO);
    doc.setLineWidth(R.aviso.borde * W);
    doc.line(ax, ay, ax + aw, ay);
    doc.setTextColor(...BLANCO);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(pt(R.aviso.fuente));
    const avisoLh = R.aviso.fuente * W * 1.28;
    const avisoLineas = doc.splitTextToSize(CREDENCIAL_TEXTOS.aviso, aw - 2 * R.aviso.padX * W) as string[];
    let ty = ay + R.aviso.padY * W + avisoLh * 0.8;
    avisoLineas.forEach((l) => {
      doc.text(l, ax + R.aviso.padX * W, ty);
      ty += avisoLh;
    });
    const avisoFin = ty - avisoLh + R.aviso.padY * W + avisoLh * 0.2;
    doc.line(ax, avisoFin, ax + aw, avisoFin);
    // Lema
    const ly = y + R.lema.y * H;
    const lemaAlto = R.lema.fuente * W * 1.05 + 2 * R.lema.padY * W;
    doc.setFillColor(...NARANJO);
    doc.rect(ax, ly, aw, lemaAlto, "F");
    doc.setTextColor(...OSCURO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(pt(R.lema.fuente));
    doc.text(CREDENCIAL_TEXTOS.lema, ax + aw / 2, ly + lemaAlto * 0.72, { align: "center" });
    // Redes
    imagenProporcional(redes, x + R.redes.x * W, y + R.redes.y * H, R.redes.w * W, tamRedes);
  }

  // Guías de corte
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  [X_FRENTE, X_REVERSO].forEach((cx) => doc.rect(cx, TOP, W, H, "S"));

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
    if (data.userType) params.set("u", data.userType);
    if (data.subjectType) params.set("s", data.subjectType);
    if (data.detailLabel) params.set("k", data.detailLabel);
    nativeSend("url.open", { url: `${window.location.origin}/credencial?${params.toString()}` });
    return;
  }
  void downloadCredentialPdf(data);
}
