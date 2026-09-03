import * as https from 'https';

/**
 * Envío de correos vía Resend (helper compartido). Lanza Error si el
 * proveedor no está configurado o el envío falla; el llamador decide si eso
 * es fatal (recuperación de código) o solo advertencia (correo de bienvenida).
 */
export async function sendResendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    throw new Error('Email provider not configured');
  }

  const payload = JSON.stringify({
    from,
    to: [input.to],
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  const { status, body } = await new Promise<{ status: number; body: string }>(
    (resolve, reject) => {
      const request = https.request(
        {
          method: 'POST',
          hostname: 'api.resend.com',
          path: '/emails',
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
    },
  );

  if (status < 200 || status >= 300) {
    throw new Error(`No se pudo enviar el correo: ${body}`);
  }
}
