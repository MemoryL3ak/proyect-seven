import {
  CARA,
  CREDENCIAL_COLORES,
  CREDENCIAL_IMAGENES,
  CREDENCIAL_TEXTOS,
  categoriaCredencial,
  zonasConcedidas,
} from "@/lib/credencial-jde";

/**
 * Credencial en HTML con el formato oficial de los Juegos Deportivos
 * Escolares 2026 (INDE): frente con franja de categoría, logos, foto, nombre y
 * zonas; reverso oscuro con QR, zonas, aviso, lema y redes. Las medidas y
 * colores salen de lib/credencial-jde, igual que el PDF.
 */
export type CredentialTemplateInput = {
  eventName: string;
  fullName: string;
  roleLabel: string;
  credentialCode: string;
  statusLabel: string;
  issuedAtLabel: string;
  issuerLabel: string;
  subjectId: string;
  providerLabel?: string;
  countryTag?: string;
  accessTypes?: string[];
  photoUrl?: string | null;
  organization?: string;
  qrDataUrl?: string | null;
  /** Tipo de participante (TA, JEFE_MISION, DRIVER…): fija la categoría impresa. */
  userType?: string | null;
  subjectType?: "PARTICIPANT" | "DRIVER";
  /** Segunda línea bajo el nombre: cargo, delegación, disciplina o proveedor. */
  detailLabel?: string | null;
  /** Categoría escrita a mano; manda sobre el tipo. */
  categoria?: string | null;
  letra?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Origen del front para que los logos carguen también en un popup o un iframe con srcDoc. */
function baseImagenes(): string {
  return typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
}

export function buildCredentialHtml(input: CredentialTemplateInput) {
  const base = baseImagenes();
  const cat = categoriaCredencial({
    userType: input.userType,
    roleLabel: input.roleLabel,
    subjectType: input.subjectType,
    categoria: input.categoria,
    letra: input.letra,
  });
  const zonas = zonasConcedidas(input.accessTypes);
  const detalle = (input.detailLabel ?? "").trim();
  const F = CARA.frente;
  const R = CARA.reverso;
  const cq = (fraccionDeCara: number) => `${(fraccionDeCara * 50).toFixed(3)}cqw`;

  const zonasFrente = zonas
    .map(
      (z) => `<div class="zona"><b>${escapeHtml(z.codigo)}</b><span>${escapeHtml(z.nombre).replaceAll("\n", "<br>")}</span></div>`,
    )
    .join("");
  const zonasReverso = zonas.map((z) => `<div class="zona"><b>${escapeHtml(z.codigo)}</b></div>`).join("");

  const foto = input.photoUrl
    ? `<div class="foto con-foto" style="background-image:url('${escapeHtml(input.photoUrl)}')"></div>`
    : `<div class="foto">SIN FOTO</div>`;

  const qr = input.qrDataUrl
    ? `<div class="qr"><img src="${escapeHtml(input.qrDataUrl)}" alt="QR de validación"><p>${escapeHtml(
        String(input.credentialCode || "").toUpperCase(),
      )}</p></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Credencial · ${escapeHtml(input.fullName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700;800;900&display=swap" rel="stylesheet">
<style>
:root{--morado:${cat.color};--oscuro:${CREDENCIAL_COLORES.oscuro};--naranjo:${CREDENCIAL_COLORES.naranjo};--blanco:${CREDENCIAL_COLORES.blanco}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Outfit',system-ui,Arial,sans-serif;background:#d9dbe0;padding:24px;display:flex;flex-direction:column;align-items:center;gap:16px}
.barra{display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:14px;color:#333}
.barra button{font:inherit;font-weight:700;background:var(--oscuro);color:#fff;border:0;border-radius:6px;padding:9px 16px;cursor:pointer}
.credencial{width:min(100%,1100px);aspect-ratio:${CARA.ancho * 2}/${CARA.alto};container-type:inline-size;display:grid;grid-template-columns:1fr 1fr;box-shadow:0 6px 24px rgba(0,0,0,.25);background:var(--blanco);overflow:hidden}
.frente{position:relative;background:var(--blanco)}
.lateral{position:absolute;left:0;top:0;width:${(F.lateralAncho * 100).toFixed(1)}%;height:100%}
.lateral .bloque{height:${(F.bloqueAlto * 100).toFixed(1)}%;background:var(--morado);display:flex;align-items:center;justify-content:center}
.lateral .letra{font-weight:900;color:#fff;font-size:${cq(F.letraFuente)};line-height:1}
.lateral .letra.larga{font-size:${cq(F.letraFuente * 0.62)}}
.lateral .franja{position:absolute;top:${(F.bloqueAlto * 100).toFixed(1)}%;bottom:0;left:0;right:0;background:var(--oscuro);border-bottom-right-radius:100% 22%;display:flex;align-items:center;justify-content:center;padding-bottom:12%}
.lateral .categoria{writing-mode:vertical-rl;transform:rotate(180deg);color:#fff;font-weight:800;font-size:${cq(F.categoriaFuente)};letter-spacing:.05em;white-space:nowrap}
.lateral .categoria.larga{font-size:${cq(F.categoriaFuente * 0.7)}}
.logos{position:absolute;top:${(F.logos.y * 100).toFixed(1)}%;left:${(F.logos.x * 100).toFixed(1)}%;width:${(F.logos.w * 100).toFixed(1)}%}
.logos img{width:100%;display:block}
.datos{position:absolute;left:${(F.datos.x * 100).toFixed(1)}%;right:${((1 - F.datos.xFin) * 100).toFixed(1)}%;top:${(F.datos.y * 100).toFixed(1)}%;bottom:${((1 - F.datos.yFin) * 100).toFixed(1)}%;display:flex;flex-direction:column;align-items:center;gap:3%}
.foto{width:${(F.fotoAncho * 100).toFixed(0)}%;aspect-ratio:3/4;border:.2cqw dashed #b7bac2;display:flex;align-items:center;justify-content:center;color:#9a9ea8;font-size:.8cqw;background:#fafafa center/cover no-repeat;text-align:center;font-weight:700;letter-spacing:.1em}
.foto.con-foto{border:0;font-size:0}
.campo{width:100%;text-align:center;color:var(--oscuro);min-height:1.2em;overflow-wrap:anywhere}
.campo.nombre{font-weight:800;font-size:${cq(F.nombreFuente)};line-height:1.1;text-transform:uppercase}
.campo.detalle{font-weight:500;font-size:${cq(F.detalleFuente)}}
.zonas{position:absolute;bottom:${(F.zonas.yDesdeAbajo * 100).toFixed(1)}%;left:${(F.zonas.x * 100).toFixed(1)}%;display:flex;gap:${cq(F.zonas.gap)}}
.zona{width:${cq(F.zonas.ancho)};text-align:center}
.zona b{display:block;background:var(--naranjo);color:#fff;font-weight:800;font-size:${cq(F.zonas.codigoFuente)};line-height:1.2}
.zona span{display:flex;align-items:center;justify-content:center;background:var(--oscuro);color:#fff;font-weight:500;font-size:${cq(F.zonas.nombreFuente)};line-height:1.15;height:${cq(F.zonas.nombreAlto)};letter-spacing:.03em}
.reverso{position:relative;background:var(--oscuro);color:#fff}
.reverso .logos{left:${(R.logos.x * 100).toFixed(1)}%;width:${(R.logos.w * 100).toFixed(1)}%}
.reverso .zonas{bottom:auto;top:${(R.zonas.y * 100).toFixed(1)}%;left:${(R.zonas.x * 100).toFixed(1)}%}
.qr{position:absolute;left:${(R.qr.x * 100).toFixed(1)}%;top:${(R.qr.y * 100).toFixed(1)}%;width:${(R.qr.w * 100).toFixed(1)}%;text-align:center}
.qr img{width:100%;display:block;background:#fff;padding:.4cqw;border-radius:.6cqw}
.qr p{margin-top:.5cqw;font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;font-size:1.1cqw;letter-spacing:.25em;color:#fff}
.aviso{position:absolute;left:${(R.aviso.x * 100).toFixed(1)}%;right:${((1 - R.aviso.xFin) * 100).toFixed(1)}%;top:${(R.aviso.y * 100).toFixed(1)}%;border-top:.15cqw solid #fff;border-bottom:.15cqw solid #fff;padding:1.3cqw 1cqw;font-size:${cq(R.aviso.fuente)};line-height:1.28;font-weight:400}
.lema{position:absolute;left:${(R.aviso.x * 100).toFixed(1)}%;right:${((1 - R.aviso.xFin) * 100).toFixed(1)}%;top:${(R.lema.y * 100).toFixed(1)}%;background:var(--naranjo);color:var(--oscuro);font-weight:800;font-size:${cq(R.lema.fuente)};text-align:center;padding:.6cqw 0;line-height:1.05;white-space:nowrap}
.redes{position:absolute;left:${(R.redes.x * 100).toFixed(1)}%;width:${(R.redes.w * 100).toFixed(1)}%;top:${(R.redes.y * 100).toFixed(1)}%}
.redes img{width:100%;display:block}
@media print{
  @page{size:auto;margin:0}
  body{background:#fff;padding:0}
  .barra{display:none}
  .credencial{box-shadow:none;width:100%}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style>
</head>
<body>
<div class="barra">
  <button type="button" onclick="window.print()">Imprimir credencial</button>
  <span>${escapeHtml(input.eventName)} · ${escapeHtml(cat.categoria)} · código ${escapeHtml(String(input.credentialCode || "").toUpperCase())}</span>
</div>

<div class="credencial">
  <section class="frente">
    <div class="lateral">
      <div class="bloque"><span class="letra${cat.letra.length > 1 ? " larga" : ""}">${escapeHtml(cat.letra)}</span></div>
      <div class="franja"><span class="categoria${cat.categoria.length > 10 ? " larga" : ""}">${escapeHtml(cat.categoria)}</span></div>
    </div>
    <div class="logos"><img src="${base}${CREDENCIAL_IMAGENES.logoFrente}" alt="Instituto Nacional de Deportes · JDE"></div>
    <div class="datos">
      ${foto}
      <div class="campo nombre">${escapeHtml(input.fullName)}</div>
      <div class="campo detalle">${escapeHtml(detalle)}</div>
    </div>
    <div class="zonas">${zonasFrente}</div>
  </section>

  <section class="reverso">
    <div class="logos"><img src="${base}${CREDENCIAL_IMAGENES.logoReverso}" alt="Instituto Nacional de Deportes · JDE"></div>
    ${qr}
    <div class="zonas">${zonasReverso}</div>
    <p class="aviso">${escapeHtml(CREDENCIAL_TEXTOS.aviso)}</p>
    <div class="lema">${escapeHtml(CREDENCIAL_TEXTOS.lema)}</div>
    <div class="redes"><img src="${base}${CREDENCIAL_IMAGENES.redes}" alt="INDChileOficial · INDChile"></div>
  </section>
</div>
</body>
</html>`;
}
