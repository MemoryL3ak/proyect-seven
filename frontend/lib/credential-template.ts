type CredentialTemplateInput = {
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
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildCredentialHtml(input: CredentialTemplateInput) {
  const organization = input.organization ?? "Seven Logistic Core";
  const providerLabel = input.providerLabel ?? "No aplica";
  const countryTag = (input.countryTag ?? "LOC").toUpperCase().slice(0, 3);
  const activeAccess = new Set((input.accessTypes ?? []).map((value) => value.toUpperCase()));
  const accessCatalog = [
    { code: "C", label: "Cancha" },
    { code: "TR", label: "Transporte" },
    { code: "H", label: "Hotel" },
    { code: "R", label: "Reuniones" },
    { code: "A", label: "Alimentacion" },
    { code: "RD", label: "Recintos Deportivos" },
  ];

  const photoBlock = input.photoUrl
    ? `<img src="${escapeHtml(input.photoUrl)}" alt="Foto acreditado" class="photo" />`
    : `<div class="photo photo-fallback">SIN FOTO</div>`;

  const accessPillsFront = accessCatalog
    .map((item) => {
      const active = activeAccess.has(item.code);
      return `<span class="access-pill ${active ? "is-active" : ""}">${escapeHtml(item.code)}</span>`;
    })
    .join("");

  const accessLegend = accessCatalog
    .map((item) => {
      const active = activeAccess.has(item.code);
      return `<div class="legend-item">
        <span class="legend-code ${active ? "is-active" : ""}">${escapeHtml(item.code)}</span>
        <span>${escapeHtml(item.label)}</span>
      </div>`;
    })
    .join("");

  const qrBlock = input.qrDataUrl
    ? `<div class="qr-panel">
        <img src="${escapeHtml(input.qrDataUrl)}" alt="QR de validacion" class="qr-image" />
        <div class="qr-label">Escanear para ver datos del acceso</div>
      </div>`
    : `<div class="qr-panel">
        <div class="qr-empty">SIN QR</div>
        <div class="qr-label">QR no disponible</div>
      </div>`;

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Credencial - ${escapeHtml(input.fullName)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #ecf1f7;
        font-family: "Segoe UI", "Inter", "Arial", sans-serif;
        color: #0f172a;
        padding: 28px;
      }
      .sheet {
        max-width: 1060px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
      }
      .card {
        position: relative;
        min-height: 640px;
        background: #ffffff;
        border: 1px solid #c7d2e2;
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.14);
      }
      .left-strip {
        position: absolute;
        inset: 0 auto 0 0;
        width: 132px;
        background: linear-gradient(180deg, #6b82c6 0%, #6c86cf 100%);
        color: #fff;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        padding: 20px 0 18px;
      }
      .country {
        font-size: 58px;
        line-height: 0.9;
        font-weight: 900;
        letter-spacing: 0.03em;
      }
      .vertical {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        letter-spacing: 0.03em;
        font-size: 46px;
        font-weight: 800;
        line-height: 0.94;
      }
      .front,
      .back {
        padding: 22px 22px 20px 150px;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      .front-header,
      .back-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
      }
      .top-right-logo {
        width: 128px;
        height: 50px;
        object-fit: contain;
      }
      .gov-logo {
        width: 120px;
        height: 50px;
        object-fit: contain;
      }
      .photo {
        width: 260px;
        height: 300px;
        border-radius: 10px;
        object-fit: cover;
        border: 1px solid rgba(15, 23, 42, 0.14);
        margin: 10px auto 14px;
      }
      .photo-fallback {
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #e2e8f0, #dbe4ef);
        color: #334155;
        font-weight: 800;
        letter-spacing: 0.14em;
        font-size: 13px;
      }
      .name {
        margin: 0;
        font-size: 44px;
        font-weight: 800;
        line-height: 1.08;
        text-align: center;
        letter-spacing: 0.01em;
      }
      .role {
        margin: 8px auto 0;
        font-size: 20px;
        font-weight: 700;
        text-align: center;
        max-width: 84%;
      }
      .meta {
        margin: 14px auto 0;
        width: 88%;
        font-size: 15px;
        line-height: 1.5;
      }
      .front-qr-wrap {
        margin: 18px auto 10px;
        width: 88%;
        display: flex;
        justify-content: center;
      }
      .access-row {
        margin-top: auto;
        display: flex;
        justify-content: center;
        gap: 7px;
        flex-wrap: wrap;
      }
      .access-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 42px;
        height: 34px;
        padding: 0 10px;
        border-radius: 10px;
        background: #dfe8ff;
        color: #6b7dab;
        font-size: 24px;
        font-weight: 800;
      }
      .access-pill.is-active {
        background: #6d85ca;
        color: #fff;
      }
      .sponsors {
        margin-top: 12px;
        text-align: center;
        font-size: 12px;
      }
      .legend-grid {
        margin: auto 0 18px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px 24px;
      }
      .legend-item {
        display: flex;
        align-items: center;
        gap: 9px;
        font-size: 16px;
        color: #6b7280;
      }
      .legend-item span:last-child {
        line-height: 1.25;
      }
      .legend-code {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 52px;
        height: 36px;
        padding: 0 10px;
        border-radius: 11px;
        background: #dfe8ff;
        color: #6b7dab;
        font-size: 24px;
        font-weight: 700;
      }
      .legend-code.is-active {
        background: #6d85ca;
        color: #fff;
      }
      .qr-panel {
        border: 1px solid #d9e2f0;
        border-radius: 18px;
        padding: 12px;
        background: linear-gradient(180deg, #f8fbff 0%, #eef4fd 100%);
        text-align: center;
      }
      .qr-image {
        width: 100%;
        aspect-ratio: 1;
        object-fit: contain;
        display: block;
        background: #fff;
        border-radius: 12px;
        padding: 8px;
      }
      .qr-label {
        margin-top: 8px;
        font-size: 13px;
        line-height: 1.35;
        color: #4f5f82;
        font-weight: 700;
      }
      .qr-empty {
        display: grid;
        place-items: center;
        min-height: 156px;
        border-radius: 12px;
        background: #fff;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
      }
      .notice {
        border-top: 2px solid #d8e6cb;
        border-bottom: 2px solid #d8e6cb;
        padding: 16px 6px;
        margin-bottom: 18px;
        color: #818ea5;
        font-size: 33px;
        line-height: 1.34;
        font-style: italic;
      }
      .social {
        margin-top: auto;
        text-align: center;
        color: #6b82c6;
        font-size: 26px;
        font-weight: 700;
      }
      .social .small {
        display: block;
        margin-top: 4px;
        font-size: 24px;
      }
      .muted {
        color: #64748b;
      }
      @media print {
        body { padding: 0; background: #fff; }
        .sheet { box-shadow: none; border-radius: 0; border: none; max-width: none; gap: 0; grid-template-columns: 1fr; }
        .card { border: none; border-radius: 0; min-height: 100vh; box-shadow: none; page-break-after: always; }
        .card:last-child { page-break-after: auto; }
      }
      @media (max-width: 980px) {
        .sheet { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <section class="sheet">
      <article class="card">
        <aside class="left-strip">
          <div class="country">${escapeHtml(countryTag)}</div>
          <div class="vertical">COMITE OPERATIVO LOCAL</div>
        </aside>
        <div class="front">
          <div class="front-header">
            <img src="/branding/fupd-left-logo.png" class="gov-logo" alt="Logo Ministerio del Deporte" />
            <img src="/branding/fupd-right-logo.png" class="top-right-logo" alt="Logo JDE" />
          </div>
          ${photoBlock}
          <h1 class="name">${escapeHtml(input.fullName)}</h1>
          <p class="role">${escapeHtml(input.roleLabel)}</p>
          <div class="meta">
            <div><strong>Emitida:</strong> ${escapeHtml(input.issuedAtLabel)}</div>
            <div><strong>Proveedor:</strong> ${escapeHtml(providerLabel)}</div>
            <div><strong>Evento:</strong> ${escapeHtml(organization)}</div>
          </div>
          <div class="front-qr-wrap">
            ${qrBlock}
          </div>
          <div class="access-row">${accessPillsFront}</div>
          <div class="sponsors muted">${escapeHtml(input.eventName)}</div>
        </div>
      </article>
      <article class="card">
        <aside class="left-strip">
          <div class="country">${escapeHtml(countryTag)}</div>
          <div class="vertical">COMITE OPERATIVO LOCAL</div>
        </aside>
        <div class="back">
          <div class="back-header">
            <img src="/branding/fupd-left-logo.png" class="gov-logo" alt="Logo Ministerio del Deporte" />
            <img src="/branding/fupd-right-logo.png" class="top-right-logo" alt="Logo JDE" />
          </div>
          <div class="legend-grid">
            ${accessLegend}
          </div>
          <div class="notice">
            Esta credencial es personal e intransferible.<br/>
            Debe portarse en forma permanente y visible durante el evento.<br/>
            En caso de perdida, favor devolverla a la organizacion.
          </div>
          <div class="social">
            @indchile <span class="small">www.ind.cl</span>
          </div>
        </div>
      </article>
    </section>
    <script>
      window.onload = () => {
        window.focus();
      };
    </script>
  </body>
</html>`;
}
