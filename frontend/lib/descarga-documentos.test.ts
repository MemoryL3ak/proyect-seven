import { describe, expect, it } from "vitest";
import { archivosDePersona, extensionDeUrl, nombreDeArchivo, urlDeDescarga } from "./descarga-documentos";

/**
 * 17-10-2026: Ariel pidió descargar los documentos desde Documentos, uno a
 * uno y todos los de una persona. Datos de un conductor real: licencia en
 * PDF y foto del vehículo en JPG, con la URL ya firmada por el backend.
 */
const FIRMADA = "https://x.supabase.co/storage/v1/object/sign/driver-documents/p1/doc_licencia-1760000000001.pdf?token=abc";

describe("descarga de documentos", () => {
  it("la URL de descarga pide el archivo como adjunto, con su nombre", () => {
    expect(urlDeDescarga(FIRMADA, "Licencia de conducir.pdf")).toBe(`${FIRMADA}&download=Licencia%20de%20conducir.pdf`);
    expect(urlDeDescarga("https://x/public/a.pdf", "a.pdf")).toBe("https://x/public/a.pdf?download=a.pdf");
  });

  it("el nombre sale de la etiqueta y la extensión de la URL (sin el token)", () => {
    expect(extensionDeUrl(FIRMADA)).toBe("pdf");
    expect(extensionDeUrl("https://x/sin-extension?token=1")).toBe("");
    expect(nombreDeArchivo("Licencia de conducir", FIRMADA)).toBe("Licencia de conducir.pdf");
    expect(nombreDeArchivo("Cert: Inhabilidades / menores?", FIRMADA)).toBe("Cert Inhabilidades menores.pdf");
    expect(nombreDeArchivo("Reglamento", "https://x/a.pdf", "reglamento-u20.pdf")).toBe("reglamento-u20.pdf");
  });

  it("lista los documentos subidos de un conductor, personales primero y luego los del vehículo", () => {
    const conductor = {
      userType: "CONDUCTOR",
      metadata: {
        isDriver: true,
        doc_foto_vehiculo: "https://x/storage/v1/object/sign/driver-documents/p1/doc_foto_vehiculo-2.jpeg?token=z",
        doc_licencia: FIRMADA,
        doc_carnet: "",
        vehiclePatente: "TRSB84",
      },
    };
    expect(archivosDePersona(conductor, "TRANSPORTE").map((a) => a.nombre)).toEqual([
      "Licencia de conducir.pdf",
      "Foto del vehículo.jpeg",
    ]);
  });

  it("un doc_ que el panel no pide entra igual; una persona sin archivos da lista vacía", () => {
    const otro = { userType: "COORDINADOR", metadata: { doc_otro_papel: "https://x/a.png" } };
    expect(archivosDePersona(otro, "TRANSPORTE")).toEqual([
      { key: "doc_otro_papel", label: "otro papel", url: "https://x/a.png", nombre: "otro papel.png" },
    ]);
    expect(archivosDePersona({ metadata: {} }, "TRANSPORTE")).toEqual([]);
  });
});
