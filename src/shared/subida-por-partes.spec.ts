import { SupabaseClient } from '@supabase/supabase-js';
import { MAX_PARTES, recibirParte } from './subida-por-partes';

/**
 * 29-09-2026: el SOAP de un conductor (PDF) no subía por datos móviles —
 * "No se pudo subir SOAP: se cortó la conexión", tres veces. La app ahora lo
 * manda en pedazos y reintenta sólo el que falla; el servidor los junta.
 */
function storageFalso() {
  const archivos = new Map<string, { buffer: Buffer; contentType?: string }>();
  const bucket = {
    upload: jest.fn(async (path: string, buffer: Buffer, opts?: { contentType?: string }) => {
      archivos.set(path, { buffer, contentType: opts?.contentType });
      return { data: { path }, error: null };
    }),
    download: jest.fn(async (path: string) => {
      const f = archivos.get(path);
      return f ? { data: new Blob([new Uint8Array(f.buffer)]), error: null } : { data: null, error: { message: 'Object not found' } };
    }),
    list: jest.fn(async (carpeta: string, opts?: { search?: string }) => ({
      data: [...archivos.keys()]
        .filter((k) => k.startsWith(`${carpeta}/`) && (!opts?.search || k.includes(opts.search)))
        .map((k) => ({ name: k.slice(carpeta.length + 1), id: k })),
      error: null,
    })),
    remove: jest.fn(async (paths: string[]) => {
      paths.forEach((p) => archivos.delete(p));
      return { data: [], error: null };
    }),
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://sb.test/storage/v1/object/public/driver-documents/${path}` } }),
  };
  const admin = { storage: { from: () => bucket } } as unknown as SupabaseClient;
  return { admin, archivos, bucket };
}

const CONDUCTOR = '504814fc-1f1c-49f2-b998-ab350b5467c2';

describe('subida de documentos por partes', () => {
  // Un "PDF" de 1,3 MB en tres pedazos de 512 KB, como los manda la app.
  const pdf = Buffer.from(Array.from({ length: 1300 * 1024 }, (_, i) => i % 251));
  const TAM = 512 * 1024;
  const pedazos = [0, 1, 2].map((i) => pdf.subarray(i * TAM, (i + 1) * TAM));
  const parte = (i: number) => ({
    key: 'doc_soap',
    contentType: 'application/pdf',
    uploadId: 'a1b2c3d4-soap',
    parte: i,
    partes: 3,
    datos: pedazos[i].toString('base64'),
  });

  it('junta las partes en el archivo original y borra las temporales', async () => {
    const { admin, archivos } = storageFalso();
    await expect(recibirParte(admin, CONDUCTOR, parte(0))).resolves.toEqual({ completo: false, recibidas: 1 });
    // la segunda parte se corta y la app la reintenta: no se duplica
    await recibirParte(admin, CONDUCTOR, parte(1));
    await recibirParte(admin, CONDUCTOR, parte(1));
    const fin = await recibirParte(admin, CONDUCTOR, parte(2));

    const ruta = `${CONDUCTOR}/doc_soap-a1b2c3d4-soap.pdf`;
    expect(fin).toEqual({ completo: true, url: `https://sb.test/storage/v1/object/public/driver-documents/${ruta}` });
    expect(archivos.get(ruta)?.buffer.equals(pdf)).toBe(true);
    expect(archivos.get(ruta)?.contentType).toBe('application/pdf');
    expect([...archivos.keys()]).toEqual([ruta]);
  });

  it('si se pierde la respuesta de la última parte, el reintento no falla', async () => {
    const { admin, archivos } = storageFalso();
    for (const i of [0, 1, 2]) await recibirParte(admin, CONDUCTOR, parte(i));
    await expect(recibirParte(admin, CONDUCTOR, parte(2))).resolves.toMatchObject({ completo: true });
    expect([...archivos.keys()]).toEqual([`${CONDUCTOR}/doc_soap-a1b2c3d4-soap.pdf`]);
  });

  it('rechaza lo que no calza: archivo demasiado grande, clave rara, persona inválida', async () => {
    const { admin } = storageFalso();
    await expect(recibirParte(admin, CONDUCTOR, { ...parte(0), partes: MAX_PARTES + 1 })).rejects.toThrow(
      'El archivo es demasiado pesado',
    );
    await expect(recibirParte(admin, CONDUCTOR, { ...parte(0), key: '../otro' })).rejects.toThrow('Documento inválido');
    await expect(recibirParte(admin, '../../x', parte(0))).rejects.toThrow('Persona inválida');
  });
});
