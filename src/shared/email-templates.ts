/**
 * Branded email HTML template for Seven platform.
 * Uses table-based layout for maximum email client compatibility.
 */
export function accessCodeEmailHtml(fullName: string, accessCode: string): string {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tu código de acceso — Seven</title>
  </head>
  <body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a;">

    <!-- Outer wrapper -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eef2f7;padding:40px 16px;">
      <tr>
        <td align="center">

          <!-- Card -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.10);">

            <!-- Teal top accent bar -->
            <tr>
              <td style="height:4px;background:linear-gradient(90deg,#21D0B3,#34F3C6,#21D0B3);"></td>
            </tr>

            <!-- Header with logo -->
            <tr>
              <td style="padding:28px 36px 20px 36px;border-bottom:1px solid #f1f5f9;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="https://seven.management/branding/LOGO-SEVEN-1.png" alt="Seven Arena" width="130" height="auto" style="display:block;border:0;outline:none;max-width:130px;" />
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <span style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;font-weight:600;">Portal de Acceso</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px 36px 28px 36px;">
                <p style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">Tu código de acceso</p>
                <p style="margin:0 0 28px 0;font-size:14px;color:#64748b;line-height:1.6;">
                  Hola <strong style="color:#0f172a;">${fullName}</strong>, aquí está tu código para ingresar al portal Seven:
                </p>

                <!-- Code block -->
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
                  <tr>
                    <td style="background:#f0fdfb;border:2px solid #21D0B3;border-radius:14px;padding:24px;text-align:center;">
                      <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#17a68e;font-weight:700;margin-bottom:10px;">Código de acceso</div>
                      <div style="font-size:34px;font-weight:800;letter-spacing:0.2em;color:#0f172a;font-family:'Courier New',Courier,monospace;">${accessCode}</div>
                    </td>
                  </tr>
                </table>

                <!-- Security note -->
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:13px 16px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td style="width:24px;vertical-align:middle;padding-right:10px;font-size:16px;">🔒</td>
                          <td style="font-size:13px;color:#92400e;line-height:1.5;">
                            Guarda este código en un lugar seguro. Es personal e intransferible.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 36px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-size:11px;color:#94a3b8;line-height:1.7;">
                      Si no solicitaste este código, puedes ignorar este mensaje.<br/>
                      &copy; ${year} Seven Management Platform
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
          <!-- /Card -->

        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Correo de bienvenida al habilitar una cuenta de portal (SA: se envía al
 * registrar un participante de proveedor con correo). Misma línea gráfica que
 * el correo de recuperación de código.
 */
export function welcomeEmailHtml(
  fullName: string,
  accessCode: string,
  portalLabel: string,
  portalUrl: string,
): string {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tu cuenta está habilitada — Seven</title>
  </head>
  <body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eef2f7;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.10);">
            <tr>
              <td style="height:4px;background:linear-gradient(90deg,#21D0B3,#34F3C6,#21D0B3);"></td>
            </tr>
            <tr>
              <td style="padding:28px 36px 20px 36px;border-bottom:1px solid #f1f5f9;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="https://seven.management/branding/LOGO-SEVEN-1.png" alt="Seven Arena" width="130" height="auto" style="display:block;border:0;outline:none;max-width:130px;" />
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <span style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;font-weight:600;">${portalLabel}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 36px 28px 36px;">
                <p style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">Tu cuenta está habilitada</p>
                <p style="margin:0 0 28px 0;font-size:14px;color:#64748b;line-height:1.6;">
                  Hola <strong style="color:#0f172a;">${fullName}</strong>, te dieron acceso a la plataforma Seven Arena. Ingresa al <strong style="color:#0f172a;">${portalLabel}</strong> con este código:
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
                  <tr>
                    <td style="background:#f0fdfb;border:2px solid #21D0B3;border-radius:14px;padding:24px;text-align:center;">
                      <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#17a68e;font-weight:700;margin-bottom:10px;">Código de acceso</div>
                      <div style="font-size:34px;font-weight:800;letter-spacing:0.2em;color:#0f172a;font-family:'Courier New',Courier,monospace;">${accessCode}</div>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
                  <tr>
                    <td align="center">
                      <a href="${portalUrl}" style="display:inline-block;background:linear-gradient(135deg,#21D0B3,#14b8a6);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:99px;padding:12px 32px;">Ir al portal</a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:13px 16px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td style="width:24px;vertical-align:middle;padding-right:10px;font-size:16px;">🔒</td>
                          <td style="font-size:13px;color:#92400e;line-height:1.5;">
                            Guarda este código en un lugar seguro. Es personal e intransferible.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 36px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-size:11px;color:#94a3b8;line-height:1.7;">
                      Si no esperabas este acceso, contacta a tu coordinador.<br/>
                      &copy; ${year} Seven Management Platform
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
