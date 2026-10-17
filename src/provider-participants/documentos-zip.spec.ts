import { archivosDeDocumentos, extensionDe, nombreDelZip, nombreSeguro } from './documentos-zip';

/**
 * 17-10-2026: Ariel pidió descargar los documentos de cada persona, uno a
 * uno y todos juntos. Los datos son los de un conductor real: licencia en
 * PDF y foto del vehículo en JPG, guardados por el portal del conductor.
 */
const BASE = 'https://jmedtzczaswxrtdqomgz.supabase.co/storage/v1/object/public/driver-documents';

describe('documentos de una persona para el .zip', () => {
  it('lista los subidos con su etiqueta y extensión, en el orden del panel', () => {
    const archivos = archivosDeDocumentos({
      doc_foto_vehiculo: `${BASE}/p1/doc_foto_vehiculo-1760000000000.jpeg`,
      doc_licencia: `${BASE}/p1/doc_licencia-1760000000001.pdf`,
      doc_carnet: '',
      vehiclePatente: 'TRSB84',
    });
    expect(archivos.map((a) => a.nombre)).toEqual(['Licencia de conducir.pdf', 'Foto del vehículo.jpeg']);
    expect(archivos[0]).toMatchObject({ clave: 'doc_licencia', bucket: 'driver-documents', path: 'p1/doc_licencia-1760000000001.pdf' });
  });

  it('una URL firmada (token caducado en la base) también se reconoce', () => {
    const firmada = 'https://x.supabase.co/storage/v1/object/sign/driver-documents/p1/doc_soap-1760000000002.pdf?token=abc';
    expect(archivosDeDocumentos({ doc_soap: firmada })).toEqual([
      expect.objectContaining({ bucket: 'driver-documents', path: 'p1/doc_soap-1760000000002.pdf', nombre: 'SOAP.pdf' }),
    ]);
  });

  it('un doc_ que el panel no conoce entra igual, con un nombre legible', () => {
    const archivos = archivosDeDocumentos({ doc_otro_papel: `${BASE}/p1/doc_otro_papel-1.png` });
    expect(archivos[0].nombre).toBe('otro papel.png');
  });

  it('sin documentos, lista vacía; un data: o texto cualquiera no cuenta', () => {
    expect(archivosDeDocumentos(null)).toEqual([]);
    expect(archivosDeDocumentos({ doc_carnet: 'data:image/png;base64,AAA', doc_soap: 'no es url' })).toEqual([]);
  });

  it('nombres: extensión, caracteres prohibidos y el nombre del .zip', () => {
    expect(extensionDe('p1/doc_licencia-1.PDF')).toBe('pdf');
    expect(extensionDe('p1/sin-extension')).toBe('bin');
    expect(nombreSeguro('Cert: Inhabilidades / menores?')).toBe('Cert Inhabilidades menores');
    expect(nombreDelZip('Carlos marcelo Hernández sepulveda')).toBe('documentos_Carlos-marcelo-Hernandez-sepulveda.zip');
    expect(nombreDelZip(null)).toBe('documentos_persona.zip');
  });
});
