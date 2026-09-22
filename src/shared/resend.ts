import * as https from 'https';

type MensajeResend = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/** Tope del lote en la API de Resend. */
export const MAX_CORREOS_POR_LOTE = 100;

function credenciales() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    throw new Error('Email provider not configured');
  }
  return { apiKey, from };
}

function postResend(apiKey: string, path: string, payload: string) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const request = https.request(
      {
        method: 'POST',
        hostname: 'api.resend.com',
        path,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (response) => {
        let dataBuffer = '';
        response.on('data', (chunk) => {
          dataBuffer += chunk;
        });
        response.on('end', () => {
          resolve({ status: response.statusCode ?? 0, body: dataBuffer });
        });
      },
    );
    request.on('error', (err) => reject(err));
    request.write(payload);
    request.end();
  });
}

/**
 * Envío de un correo vía Resend (helper compartido). Lanza Error si el
 * proveedor no está configurado o el envío falla; el llamador decide si eso
 * es fatal (recuperación de código) o solo advertencia (correo de bienvenida).
 */
export async function sendResendEmail(input: MensajeResend): Promise<void> {
  const { apiKey, from } = credenciales();
  const payload = JSON.stringify({
    from,
    to: [input.to],
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  const { status, body } = await postResend(apiKey, '/emails', payload);
  if (status < 200 || status >= 300) {
    throw new Error(`No se pudo enviar el correo: ${body}`);
  }
}

/**
 * Hasta cien correos en una sola petición (POST /emails/batch).
 *
 * Resend limita las *peticiones* por segundo, no los correos: mandar la
 * nómina de a uno se come el límite y devuelve 429 a la mitad, mientras que
 * en lotes de cien son veinticuatro peticiones para todo un evento.
 *
 * Devuelve cuántos aceptó el servidor. La respuesta trae un id por mensaje en
 * el mismo orden en que se mandaron, así que si vuelven menos ids que
 * mensajes, los que faltan no salieron y el llamador tiene que decirlo.
 */
export async function sendResendBatch(mensajes: MensajeResend[]): Promise<number> {
  if (mensajes.length === 0) return 0;
  if (mensajes.length > MAX_CORREOS_POR_LOTE) {
    throw new Error(`El lote admite hasta ${MAX_CORREOS_POR_LOTE} correos`);
  }
  const { apiKey, from } = credenciales();
  const payload = JSON.stringify(
    mensajes.map((mensaje) => ({
      from,
      to: [mensaje.to],
      subject: mensaje.subject,
      text: mensaje.text,
      html: mensaje.html,
    })),
  );

  const { status, body } = await postResend(apiKey, '/emails/batch', payload);
  if (status < 200 || status >= 300) {
    throw new Error(`No se pudo enviar el lote: ${body}`);
  }

  try {
    const parsed = JSON.parse(body) as { data?: unknown };
    if (Array.isArray(parsed?.data)) return parsed.data.length;
  } catch {
    // Respuesta ilegible con código 2xx: se toma por buena antes que
    // reportar como fallidos correos que probablemente sí salieron.
  }
  return mensajes.length;
}
