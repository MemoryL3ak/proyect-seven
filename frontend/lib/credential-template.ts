type CredentialTemplateInput = {
  eventName: string;
  fullName: string;
  roleLabel: string;
  credentialCode: string;
  statusLabel: string;
  issuedAtLabel: string;
  issuerLabel: string;
  subjectId: string;
  photoUrl?: string | null;
  organization?: string;
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
  const photoBlock = input.photoUrl
    ? `<img src="${escapeHtml(input.photoUrl)}" alt="Foto acreditado" class="photo" />`
    : `<div class="photo photo-fallback">SIN FOTO</div>`;

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
        background: radial-gradient(circle at 20% 20%, #e0f2fe 0%, #f8fafc 48%, #e2e8f0 100%);
        font-family: "Segoe UI", "Inter", "Arial", sans-serif;
        color: #0f172a;
        padding: 32px;
      }
      .sheet {
        max-width: 920px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 24px;
        box-shadow: 0 30px 80px rgba(15, 23, 42, 0.25);
        overflow: hidden;
        border: 1px solid rgba(148, 163, 184, 0.3);
      }
      .top {
        position: relative;
        padding: 28px 34px;
        background: linear-gradient(135deg, #0f172a 0%, #0f766e 70%, #14b8a6 100%);
        color: #f8fafc;
      }
      .top:after {
        content: "";
        position: absolute;
        right: -110px;
        top: -60px;
        width: 280px;
        height: 280px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.14);
      }
      .eyebrow {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.34em;
        opacity: 0.88;
      }
      .title {
        margin: 8px 0 0;
        font-size: 30px;
        line-height: 1.2;
        font-weight: 800;
      }
      .subtitle {
        margin-top: 6px;
        font-size: 14px;
        opacity: 0.9;
      }
      .body {
        display: grid;
        grid-template-columns: 260px 1fr;
        gap: 28px;
        padding: 30px 34px 34px;
      }
      .left {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .photo {
        width: 100%;
        aspect-ratio: 3/4;
        border-radius: 18px;
        object-fit: cover;
        border: 1px solid rgba(15, 23, 42, 0.18);
        box-shadow: 0 16px 34px rgba(15, 23, 42, 0.2);
      }
      .photo-fallback {
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
        color: #334155;
        font-weight: 800;
        letter-spacing: 0.16em;
        font-size: 13px;
      }
      .chip {
        display: inline-flex;
        width: fit-content;
        align-items: center;
        border-radius: 999px;
        background: #ecfeff;
        color: #0f766e;
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        border: 1px solid #99f6e4;
      }
      .right h1 {
        margin: 0;
        font-size: 34px;
        font-weight: 800;
        letter-spacing: 0.01em;
      }
      .role {
        margin-top: 4px;
        font-size: 16px;
        color: #0f766e;
        font-weight: 700;
      }
      .grid {
        margin-top: 18px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .cell {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 11px 12px;
        background: #f8fafc;
      }
      .label {
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #64748b;
      }
      .value {
        margin-top: 4px;
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
        word-break: break-word;
      }
      .footer {
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px dashed #cbd5e1;
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 10px;
      }
      .code {
        font-family: ui-monospace, "Cascadia Code", "SFMono-Regular", Menlo, monospace;
        font-size: 24px;
        font-weight: 800;
        letter-spacing: 0.09em;
      }
      .barcode {
        margin-top: 8px;
        width: 290px;
        height: 46px;
        border-radius: 8px;
        background:
          repeating-linear-gradient(
            90deg,
            #0f172a 0 3px,
            transparent 3px 5px,
            #0f172a 5px 9px,
            transparent 9px 12px
          );
        border: 1px solid #cbd5e1;
      }
      .organization {
        margin-top: 18px;
        font-size: 11px;
        color: #64748b;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      @media print {
        body { padding: 0; background: #fff; }
        .sheet { box-shadow: none; border-radius: 0; border: none; }
      }
    </style>
  </head>
  <body>
    <article class="sheet">
      <header class="top">
        <div class="eyebrow">Credencial Oficial</div>
        <h2 class="title">${escapeHtml(input.eventName)}</h2>
        <p class="subtitle">${escapeHtml(organization)}</p>
      </header>
      <section class="body">
        <aside class="left">
          ${photoBlock}
          <span class="chip">${escapeHtml(input.statusLabel)}</span>
        </aside>
        <main class="right">
          <h1>${escapeHtml(input.fullName)}</h1>
          <p class="role">${escapeHtml(input.roleLabel)}</p>
          <div class="grid">
            <div class="cell"><div class="label">ID Sujeto</div><div class="value">${escapeHtml(input.subjectId)}</div></div>
            <div class="cell"><div class="label">Código Credencial</div><div class="value">${escapeHtml(input.credentialCode)}</div></div>
            <div class="cell"><div class="label">Emitida</div><div class="value">${escapeHtml(input.issuedAtLabel)}</div></div>
            <div class="cell"><div class="label">Operador</div><div class="value">${escapeHtml(input.issuerLabel)}</div></div>
          </div>
          <div class="footer">
            <div>
              <div class="code">${escapeHtml(input.credentialCode)}</div>
              <div class="barcode" aria-hidden="true"></div>
            </div>
            <div class="organization">${escapeHtml(organization)}</div>
          </div>
        </main>
      </section>
    </article>
    <script>
      window.onload = () => {
        window.focus();
      };
    </script>
  </body>
</html>`;
}

